import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";

describe("Hono authentication", () => {
  const saved = Object.fromEntries(
    [
      "HOMEPAGE_AUTH_ENABLED",
      "HOMEPAGE_AUTH_PASSWORD",
      "HOMEPAGE_AUTH_SECRET",
      "HOMEPAGE_OIDC_ISSUER",
      "HOMEPAGE_OIDC_CLIENT_ID",
      "HOMEPAGE_OIDC_CLIENT_SECRET",
      "HOMEPAGE_EXTERNAL_URL",
    ].map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("redirects protected requests and accepts a signed password session", async () => {
    process.env.HOMEPAGE_AUTH_ENABLED = "true";
    process.env.HOMEPAGE_AUTH_PASSWORD = "secret";
    process.env.HOMEPAGE_AUTH_SECRET = "signing-secret";
    const app = createApp();

    expect((await app.request("/", { redirect: "manual" })).headers.get("location")).toContain("/auth/signin");
    expect((await app.request("/api/ping", { redirect: "manual", headers: { host: "localhost:3000" } })).status).toBe(302);
    expect((await app.request("/api/healthcheck", { headers: { host: "localhost:3000" } })).status).toBe(200);
    const signIn = await app.request("/auth/signin", { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=secret" });
    const session = signIn.headers.get("set-cookie");
    expect(session).toContain("daemun_session=");
    expect((await app.request("/", { headers: { cookie: session || "" } })).status).toBe(200);
  });

  it("protects the static home root before its middleware runs", async () => {
    process.env.HOMEPAGE_AUTH_ENABLED = "true";
    process.env.HOMEPAGE_AUTH_PASSWORD = "secret";
    process.env.HOMEPAGE_AUTH_SECRET = "signing-secret";
    const handler = vi.fn(async (_c, next) => next());
    const middleware = vi.fn(() => handler);
    const app = createApp({ staticHome: { middleware } });

    expect((await app.request("/", { redirect: "manual" })).status).toBe(302);
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps the OIDC callback outside session protection and rejects missing state", async () => {
    process.env.HOMEPAGE_AUTH_ENABLED = "true";
    process.env.HOMEPAGE_AUTH_SECRET = "signing-secret";
    process.env.HOMEPAGE_OIDC_ISSUER = "https://issuer.example";
    process.env.HOMEPAGE_OIDC_CLIENT_ID = "client";
    process.env.HOMEPAGE_OIDC_CLIENT_SECRET = "client-secret";
    process.env.HOMEPAGE_EXTERNAL_URL = "https://daemun.example";

    const response = await createApp().request("/api/auth/callback", {
      redirect: "manual",
      headers: { host: "localhost:3000" },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/auth/signin?error=Callback");
  });
});
