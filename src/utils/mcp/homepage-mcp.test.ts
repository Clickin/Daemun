import { afterEach, describe, expect, it } from "vitest";

import { handleMcpRequest, mcpAuthorized, mcpEnabled } from "./homepage-mcp";

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
    expect(mcpAuthorized(new Headers({ authorization: "Bearer secret" }))).toBe(true);
    expect(mcpAuthorized(new Headers())).toBe(false);
  });

  it("lists only read-only tools", () => {
    const response = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(response).toMatchObject({
      result: { tools: expect.arrayContaining([expect.objectContaining({ name: "read_config_file" })]) },
    });
    expect(JSON.stringify(response)).not.toContain("write_config_file");
  });
});
