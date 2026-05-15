import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

class MemoryStorage {
  #items = new Map();

  get length() {
    return this.#items.size;
  }

  clear() {
    this.#items.clear();
  }

  getItem(key) {
    return this.#items.get(String(key)) ?? null;
  }

  key(index) {
    return Array.from(this.#items.keys())[index] ?? null;
  }

  removeItem(key) {
    this.#items.delete(String(key));
  }

  setItem(key, value) {
    this.#items.set(String(key), String(value));
  }
}

function installBrowserStorage() {
  if (typeof window === "undefined") return;

  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }

  if (!storage) {
    storage = new MemoryStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
  }

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

beforeEach(() => {
  installBrowserStorage();
});

afterEach(() => {
  // Node-environment tests shouldn't require jsdom; guard cleanup accordingly.
  if (typeof document !== "undefined") cleanup();
});

// implement a couple of common formatters mocked in react-i18next
vi.mock("react-i18next", () => ({
  initReactI18next: { init: vi.fn(), type: "3rdParty" },
  useTranslation: () => ({
    i18n: { changeLanguage: vi.fn(), language: "en" },
    t: (key, opts) => {
      if (key === "common.number") return String(opts?.value ?? "");
      if (key === "common.percent") return String(opts?.value ?? "");
      if (key === "common.bytes") return String(opts?.value ?? "");
      if (key === "common.bbytes") return String(opts?.value ?? "");
      if (key === "common.byterate") return String(opts?.value ?? "");
      if (key === "common.bibyterate") return String(opts?.value ?? "");
      if (key === "common.bitrate") return String(opts?.value ?? "");
      if (key === "common.duration") return String(opts?.value ?? "");
      if (key === "common.ms") return String(opts?.value ?? "");
      if (key === "common.date") return String(opts?.value ?? "");
      if (key === "common.relativeDate") return String(opts?.value ?? "");
      return key;
    },
  }),
}));
