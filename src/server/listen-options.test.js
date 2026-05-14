import { describe, expect, it } from "vitest";

import { getListenOptions } from "./listen-options.js";

describe("getListenOptions", () => {
  it("prefers CLI host and port over environment values", () => {
    expect(
      getListenOptions({
        argv: ["--host", "127.0.0.1", "--port=3000"],
        env: { HOSTNAME: "0.0.0.0", PORT: "8080" },
      }),
    ).toEqual({ hostname: "127.0.0.1", port: 3000, socketPath: undefined });
  });

  it("falls back to environment values for local development", () => {
    expect(
      getListenOptions({
        argv: [],
        env: { HOST: "0.0.0.0", PORT: "4321" },
      }),
    ).toEqual({ hostname: "0.0.0.0", port: 4321, socketPath: undefined });
  });

  it("keeps CLI socket path separate from the validation port", () => {
    expect(
      getListenOptions({
        argv: ["--socket", "/run/daemun/daemun.sock", "--port", "3000"],
        env: { HOSTNAME: "0.0.0.0", PORT: "9999" },
      }),
    ).toEqual({ hostname: "0.0.0.0", port: 3000, socketPath: "/run/daemun/daemun.sock" });
  });

  it("rejects invalid ports", () => {
    expect(() => getListenOptions({ argv: ["--port", "not-a-port"], env: {} })).toThrow("Invalid port");
  });
});
