import type { Mock } from "vitest";

declare global {
  type VitestMockProcedure = (...args: Parameters<Mock>) => ReturnType<Mock>;
}

export {};
