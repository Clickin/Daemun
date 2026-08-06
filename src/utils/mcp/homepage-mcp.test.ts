import { afterEach, describe, expect, it } from "vitest";

import { handleMcpRequest, mcpEnabled, mcpTokenAuthorized } from "./homepage-mcp";

describe("Homepage MCP", () => {
  const originalEnabled = process.env.HOMEPAGE_MCP_ENABLED;
  const originalToken = process.env.HOMEPAGE_MCP_TOKEN;

  afterEach(() => {
    process.env.HOMEPAGE_MCP_ENABLED = originalEnabled;
    process.env.HOMEPAGE_MCP_TOKEN = originalToken;
  });

  it("is opt-in and accepts only the configured token", () => {
    process.env.HOMEPAGE_MCP_ENABLED = "true";
    process.env.HOMEPAGE_MCP_TOKEN = "secret";

    expect(mcpEnabled()).toBe(true);
    expect(mcpTokenAuthorized(new Headers({ authorization: "Bearer secret" }))).toBe(true);
    expect(mcpTokenAuthorized(new Headers({ "x-homepage-mcp-token": "secret" }))).toBe(true);
    expect(mcpTokenAuthorized(new Headers())).toBe(false);
    expect(mcpTokenAuthorized(new Headers({ authorization: "Bearer wrong" }))).toBe(false);
  });

  it("requires a token and compares multibyte tokens in constant time", () => {
    delete process.env.HOMEPAGE_MCP_TOKEN;
    expect(mcpTokenAuthorized(new Headers())).toBe(false);

    process.env.HOMEPAGE_MCP_TOKEN = "é";
    expect(mcpTokenAuthorized(new Headers({ authorization: "Bearer a" }))).toBe(false);
    expect(mcpTokenAuthorized(new Headers({ authorization: "Bearer é" }))).toBe(true);
  });

  it("lists only read-only tools", () => {
    const response = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(response).toMatchObject({
      result: { tools: expect.arrayContaining([expect.objectContaining({ name: "read_config_file" })]) },
    });
    expect(JSON.stringify(response)).not.toContain("write_config_file");
  });
});
