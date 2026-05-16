import { beforeEach, describe, expect, it, vi } from "vitest";

import { DaemunMemoryCache } from "./cache";

describe("utils/cache", () => {
  let cache: DaemunMemoryCache;

  beforeEach(() => {
    cache = new DaemunMemoryCache();
  });

  it("returns null on a cache miss", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("stores and returns values without cloning them", () => {
    const value = { ok: true };

    expect(cache.put("key", value)).toBe(value);
    expect(cache.get("key")).toBe(value);
  });

  it("deletes values and reports whether a key existed", () => {
    cache.put("key", "value");

    expect(cache.del("key")).toBe(true);
    expect(cache.del("key")).toBe(false);
    expect(cache.get("key")).toBeNull();
  });

  it("expires values after the ttl and invokes the timeout callback", () => {
    vi.useFakeTimers();
    try {
      const onTimeout = vi.fn();

      cache.put("key", "value", 1000, onTimeout);
      expect(cache.get("key")).toBe("value");

      vi.advanceTimersByTime(1000);

      expect(cache.get("key")).toBeNull();
      expect(onTimeout).toHaveBeenCalledWith("key", "value");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears values, timers, and key metadata", () => {
    vi.useFakeTimers();
    try {
      const onTimeout = vi.fn();

      cache.put("a", 1, 1000, onTimeout);
      cache.put("b", 2);

      expect(cache.keys().sort()).toEqual(["a", "b"]);
      expect(cache.size()).toBe(2);

      cache.clear();
      vi.advanceTimersByTime(1000);

      expect(cache.keys()).toEqual([]);
      expect(cache.size()).toBe(0);
      expect(onTimeout).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
