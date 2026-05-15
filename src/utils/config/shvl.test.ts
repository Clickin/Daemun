import { describe, expect, it } from "vitest";

import { get, set } from "./shvl";

describe("utils/config/shvl", () => {
  it("get reads nested paths with arrays and returns default when missing", () => {
    const obj = { a: { b: [{ c: 1 }] } };

    expect(get(obj, "a.b[0].c")).toBe(1);
    expect(get(obj, "a.b[1].c", "dflt")).toBe("dflt");
  });

  it("set creates nested objects/arrays as needed", () => {
    const obj = {};
    set(obj, "a.b[0].c", 123);

    expect(obj).toEqual({ a: { b: [{ c: 123 }] } });
  });

  it("set blocks prototype pollution", () => {
    const obj: { polluted?: unknown } = {};
    set(obj, "__proto__.polluted", true);
    set(obj, "a.__proto__.polluted", true);
    set(obj, "constructor.prototype.polluted", true);

    expect(obj.polluted).toBeUndefined();
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  });
});
