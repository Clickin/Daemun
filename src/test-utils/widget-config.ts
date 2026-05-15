import { expect } from "vitest";
import type { UnknownRecord } from "../types";

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

export function expectWidgetConfigShape(widget: UnknownRecord) {
  expect(widget).toBeTruthy();
  expect(widget).toBeTypeOf("object");

  if ("api" in widget) {
    expect(widget.api).toBeTypeOf("string");
    // Widget APIs are either service-backed (`{url}` template) or third-party API URLs.
    const api = String(widget.api);
    expect(api.includes("{url}") || /^https?:\/\//.test(api)).toBe(true);
  }

  if ("proxyHandler" in widget) {
    expect(widget.proxyHandler).toBeTypeOf("function");
  }

  if ("allowedEndpoints" in widget) {
    expect(widget.allowedEndpoints).toBeInstanceOf(RegExp);
  }

  if ("mappings" in widget && isRecord(widget.mappings)) {
    expect(widget.mappings).toBeTruthy();
    expect(widget.mappings).toBeTypeOf("object");

    for (const [name, mapping] of Object.entries(widget.mappings)) {
      expect(name).toBeTruthy();
      expect(mapping).toBeTruthy();
      expect(mapping).toBeTypeOf("object");

      if (isRecord(mapping) && "endpoint" in mapping) {
        expect(mapping.endpoint).toBeTypeOf("string");
        expect(String(mapping.endpoint).length).toBeGreaterThan(0);
      }
      if (isRecord(mapping) && "map" in mapping) {
        const map = mapping.map;
        const proxyName = typeof widget.proxyHandler === "function" ? widget.proxyHandler.name : "genericProxyHandler";

        // Most handlers treat `map` as a transform function. A small number of custom
        // proxies treat it as an options object.
        expect(["function", "object"].includes(typeof map)).toBe(true);

        if (typeof map === "object") {
          expect(map).not.toBeNull();
          expect(Array.isArray(map)).toBe(false);
          // Generic handlers will call `map(resultData)`, so they must never receive an object.
          expect(proxyName).not.toBe("genericProxyHandler");
          expect(proxyName).not.toBe("credentialedProxyHandler");
        }
      }
    }
  }
}
