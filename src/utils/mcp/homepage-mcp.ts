import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

import { CONF_DIR } from "utils/config/config";

const configFiles = [
  "settings.yaml",
  "services.yaml",
  "bookmarks.yaml",
  "widgets.yaml",
  "docker.yaml",
  "kubernetes.yaml",
  "proxmox.yaml",
  "custom.css",
  "custom.js",
] as const;
const yamlConfigFiles = new Set(configFiles.filter((file) => file.endsWith(".yaml")));

type ConfigFile = (typeof configFiles)[number];

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}

function assertConfigFile(file: unknown): asserts file is ConfigFile {
  if (typeof file !== "string" || !configFiles.includes(file as ConfigFile)) {
    throw new Error(`Unsupported config file '${file}'.`);
  }
}

function readConfig(file: ConfigFile) {
  const path = join(CONF_DIR, file);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function validateYaml(file: ConfigFile, content: string) {
  if (!yamlConfigFiles.has(file)) return { valid: true };
  try {
    yaml.load(content);
    return { valid: true };
  } catch (error) {
    const yamlError = error as { mark?: { line: number; column: number; snippet?: string }; message: string };
    return {
      valid: false,
      error: yamlError.message,
      ...(yamlError.mark && {
        mark: {
          line: yamlError.mark.line + 1,
          column: yamlError.mark.column + 1,
          snippet: yamlError.mark.snippet,
        },
      }),
    };
  }
}

function toolDefinitions() {
  return [
    { name: "list_config_files", description: "List supported Daemun config files.", inputSchema: { type: "object" } },
    {
      name: "read_config_file",
      description: "Read one supported config file.",
      inputSchema: { type: "object", properties: { file: { type: "string", enum: configFiles } }, required: ["file"] },
    },
    {
      name: "validate_config_file",
      description: "Validate YAML from a config file or supplied content.",
      inputSchema: {
        type: "object",
        properties: { file: { type: "string", enum: [...yamlConfigFiles] }, content: { type: "string" } },
        required: ["file"],
      },
    },
    {
      name: "homepage_docs",
      description: "Return Daemun configuration documentation links.",
      inputSchema: { type: "object" },
    },
  ];
}

function callTool(name: unknown, args: Record<string, unknown>) {
  switch (name) {
    case "list_config_files":
      return textContent(
        JSON.stringify({
          configDir: CONF_DIR,
          files: configFiles.map((file) => ({ file, exists: existsSync(join(CONF_DIR, file)), writable: false })),
        }),
      );
    case "read_config_file":
      assertConfigFile(args.file);
      return textContent(readConfig(args.file));
    case "validate_config_file": {
      assertConfigFile(args.file);
      if (!yamlConfigFiles.has(args.file)) throw new Error("Only YAML config files can be validated.");
      const content = typeof args.content === "string" ? args.content : readConfig(args.file);
      return textContent(JSON.stringify(validateYaml(args.file, content)));
    }
    case "homepage_docs":
      return textContent(JSON.stringify({ url: "https://clickin.github.io/Daemun/configs/" }));
    default:
      throw new Error(`Unknown tool '${name}'.`);
  }
}

export function mcpEnabled() {
  return process.env.HOMEPAGE_MCP_ENABLED === "true";
}

export function mcpAuthorized(headers: Headers) {
  const token = process.env.HOMEPAGE_MCP_TOKEN;
  return !token || headers.get("authorization") === `Bearer ${token}` || headers.get("x-homepage-mcp-token") === token;
}

export function handleMcpRequest(message: unknown) {
  const request = message as {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: { name?: string; arguments?: Record<string, unknown>; uri?: string };
  };
  if (request?.jsonrpc !== "2.0" || typeof request.method !== "string")
    return jsonRpcError(request?.id, -32600, "Invalid JSON-RPC request");
  if (request.method.startsWith("notifications/")) return null;

  try {
    switch (request.method) {
      case "initialize":
        return jsonRpcResult(request.id, {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "daemun", version: "1.0.0" },
          instructions: "Daemun MCP is read-only.",
        });
      case "tools/list":
        return jsonRpcResult(request.id, { tools: toolDefinitions() });
      case "tools/call":
        return jsonRpcResult(request.id, callTool(request.params?.name, request.params?.arguments ?? {}));
      case "resources/list":
        return jsonRpcResult(request.id, {
          resources: configFiles.map((file) => ({
            uri: `homepage://config/${file}`,
            name: file,
            mimeType: file.endsWith(".yaml") ? "application/yaml" : "text/plain",
          })),
        });
      case "resources/read": {
        const file = request.params?.uri?.replace("homepage://config/", "");
        assertConfigFile(file);
        return jsonRpcResult(request.id, {
          contents: [
            {
              uri: request.params?.uri,
              mimeType: file.endsWith(".yaml") ? "application/yaml" : "text/plain",
              text: readConfig(file),
            },
          ],
        });
      }
      default:
        return jsonRpcError(request.id, -32601, `Method not found: ${request.method}`);
    }
  } catch (error) {
    return jsonRpcError(request.id, -32602, (error as Error).message);
  }
}
