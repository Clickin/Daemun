type DynamicJson = ReturnType<typeof JSON.parse>;

declare global {
  interface ObjectConstructor {
    entries(o: DynamicJson): [string, DynamicJson][];
    values(o: DynamicJson): DynamicJson[];
  }
}

export {};
