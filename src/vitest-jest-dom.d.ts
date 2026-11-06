// jest-dom only augments `Assertion<T>`; Vitest 4+ declares `Assertion<R, T>`,
// so bridge its matcher types (loaded via tsconfig `types`) onto Vitest's shape.
declare module "vitest" {
  interface Assertion<R, T> extends jest.Matchers<R, T> {}
  interface AsymmetricMatchersContaining extends jest.Matchers<void, unknown> {}
}

export {};
