import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { inertia, serializePage } from "./inertia";

describe("inertia middleware", () => {
  it("serializes page objects safely for JSON script tags", () => {
    expect(serializePage({ props: { value: "</script>" } })).toContain("<\\/script>");
  });

  it("returns an Inertia page object for X-Inertia requests", async () => {
    const app = new Hono();
    app.use(inertia({ version: "test-version" }));
    app.get("/", (c) => c.render("Home", { message: "hello" }));

    const response = await app.request("http://example.test/?q=1", {
      headers: {
        "X-Inertia": "true",
        "X-Inertia-Version": "test-version",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Inertia")).toBe("true");
    expect(await response.json()).toEqual({
      component: "Home",
      props: { message: "hello" },
      url: "/?q=1",
      version: "test-version",
    });
  });

  it("returns 409 when the client Inertia asset version is stale", async () => {
    const app = new Hono();
    app.use(inertia({ version: "current" }));
    app.get("/", (c) => c.render("Home", {}));

    const response = await app.request("http://example.test/dashboard", {
      headers: {
        "X-Inertia": "true",
        "X-Inertia-Version": "old",
      },
    });

    expect(response.status).toBe(409);
    expect(response.headers.get("X-Inertia-Location")).toBe("http://example.test/dashboard");
  });
});
