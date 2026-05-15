import { JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { formatApiCall } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";
import widgets from "widgets/widgets";

import type { UnknownRecord } from "../../../types";

const logger = createLogger("jsonrpcProxyHandler");

interface JsonRpcWidget extends UnknownRecord {
  key?: string;
  password?: string;
  type?: string;
  username?: string;
}

interface JsonRpcMapping {
  endpoint?: string;
  params?: unknown;
}

interface JsonRpcWidgetDefinition {
  api?: string;
  mappings?: Record<string, JsonRpcMapping>;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

export async function sendJsonRpcRequest(
  url: string,
  method: string,
  params: unknown,
  widget: JsonRpcWidget = {},
): Promise<[number, string, string]> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  if (widget?.username && widget?.password) {
    headers.Authorization = `Basic ${Buffer.from(`${widget.username}:${widget.password}`).toString("base64")}`;
  }

  if (widget?.key) {
    headers.Authorization = `Bearer ${widget.key}`;
  }

  const client = new JSONRPCClient(async (rpcRequest) => {
    const body = JSON.stringify(rpcRequest);
    const httpRequestParams = {
      method: "POST",
      headers,
      body,
    };

    const [status, contentType, data] = await httpProxy(url, httpRequestParams);
    if (status === 200) {
      const json = JSON.parse(data.toString());

      if (json.id === null) {
        json.id = 1;
      }

      // in order to get access to the underlying error object in the JSON response
      // you must set `result` equal to undefined
      if (json.error && json.result === null) {
        json.result = undefined;
      }
      return client.receive(json);
    }

    return Promise.reject(isRecord(data) && data.error ? data : new Error(data.toString()));
  });

  try {
    const response = await client.request(method, params);
    return [200, "application/json", JSON.stringify(response)];
  } catch (e) {
    if (e instanceof JSONRPCErrorException) {
      logger.debug("Error calling JSONPRC endpoint: %s.  %s", url, e.message);
      return [200, "application/json", JSON.stringify({ result: null, error: { code: e.code, message: e.message } })];
    }

    logger.warn("Error calling JSONPRC endpoint: %s.  %s", url, e);
    return [
      500,
      "application/json",
      JSON.stringify({ result: null, error: { code: 2, message: e instanceof Error ? e.toString() : String(e) } }),
    ];
  }
}

export default async function jsonrpcProxyHandler(req, res) {
  const { group, service, endpoint: method, index } = req.query;
  const methodName = Array.isArray(method) ? method[0] : method;

  if (group && service && methodName) {
    const widget = (await getServiceWidget(group, service, index)) as JsonRpcWidget | null;
    if (!widget?.type) {
      return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const definition = widgets?.[widget.type] as JsonRpcWidgetDefinition | undefined;
    const api = definition?.api;

    const mapping = Object.values(definition?.mappings ?? {}).find((value) => value.endpoint === methodName);
    const params = mapping?.params ?? null;

    if (!api) {
      return res.status(403).json({ error: "Service does not support API calls" });
    }

    if (widget) {
      const url = formatApiCall(api, { ...widget });

      const [status, , data] = await sendJsonRpcRequest(url, methodName, params, widget);
      return res.status(status).end(data);
    }
  }

  logger.debug("Invalid or missing proxy service type '%s' in group '%s'", service, group);
  return res.status(400).json({ error: "Invalid proxy service type" });
}
