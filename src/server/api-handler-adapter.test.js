import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { honoApiHandler, splitCatchAll } from "./api-handler-adapter";

describe("honoApiHandler", () => {
  it("passes mutable req/res objects to an API handler", async () => {
    const app = new Hono();

    app.all(
      "/api/example/:service",
      honoApiHandler(
        async (req, res) => {
          req.query.endpoint = `${req.query.service}:${req.query.endpoint}`;

          return res.status(202).json({
            body: req.body,
            endpoint: req.query.endpoint,
            header: req.headers["x-test-header"],
            method: req.method,
          });
        },
        (c) => ({ service: c.req.param("service") }),
      ),
    );

    const response = await app.request("/api/example/demo?endpoint=status", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-header": "present",
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      body: { ok: true },
      endpoint: "demo:status",
      header: "present",
      method: "POST",
    });
  });

  it("preserves text response headers from res.setHeader().end()", async () => {
    const app = new Hono();

    app.get(
      "/api/text",
      honoApiHandler((req, res) => {
        res.setHeader("Content-Type", "text/plain");
        return res.status(201).end("created");
      }),
    );

    const response = await app.request("/api/text");

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("created");
  });

  it("keeps catch-all route params as decoded arrays", () => {
    expect(splitCatchAll("group/service%20name/widget")).toEqual(["group", "service name", "widget"]);
  });

  it("lets route params override query-string values like dynamic routes", async () => {
    const app = new Hono();

    app.get(
      "/api/config/:path",
      honoApiHandler(
        (req, res) =>
          res.json({
            path: req.query.path,
          }),
        (c) => ({ path: c.req.param("path") }),
      ),
    );

    const response = await app.request("/api/config/custom.css?path=ignored");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "custom.css" });
  });
});
