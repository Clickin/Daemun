import { CacheableMemory } from "@cacheable/memory";

type TimeoutCallback = (key: string, value: unknown) => void;

class DaemunMemoryCache {
  private readonly cache = new CacheableMemory({ useClone: false });
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  put<T>(key: string, value: T, time?: number, timeoutCallback?: TimeoutCallback) {
    if (typeof time !== "undefined" && (typeof time !== "number" || Number.isNaN(time) || time <= 0)) {
      throw new Error("Cache timeout must be a positive number");
    }

    if (typeof timeoutCallback !== "undefined" && typeof timeoutCallback !== "function") {
      throw new Error("Cache timeout callback must be a function");
    }

    this.clearTimer(key);
    this.cache.set(key, value, time);

    if (typeof time === "number") {
      this.timers.set(
        key,
        setTimeout(() => {
          this.timers.delete(key);
          this.cache.delete(key);
          timeoutCallback?.(key, value);
        }, time),
      );
    }

    return value;
  }

  get<T = unknown>(key: string): T | null | undefined {
    const value = this.cache.get<T>(key);
    if (typeof value !== "undefined") {
      return value;
    }

    return this.cache.has(key) ? undefined : null;
  }

  del(key: string) {
    const existed = this.cache.has(key);
    this.clearTimer(key);
    this.cache.delete(key);
    return existed;
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  memsize() {
    return this.cache.size;
  }

  keys() {
    return [...this.cache.keys];
  }

  private clearTimer(key: string) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

export { DaemunMemoryCache };
export default new DaemunMemoryCache();
