import { expect } from "vitest";

export function findServiceBlockByLabel(container: ParentNode, label: string) {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>(".service-block"));
  return blocks.find((b) => b.textContent?.includes(label));
}

export function expectBlockValue(container: ParentNode, label: string, value: unknown) {
  const block = findServiceBlockByLabel(container, label);
  expect(block, `missing block for ${label}`).toBeTruthy();
  expect(block.textContent).toContain(String(value));
}
