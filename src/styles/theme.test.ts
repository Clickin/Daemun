import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const themeCss = readFileSync(path.join(process.cwd(), "src/styles/theme.css"), "utf8");

function blockFor(selector: string) {
  const start = themeCss.indexOf(`${selector} {`);
  if (start < 0) return "";
  const end = themeCss.indexOf("\n}", start);
  return themeCss.slice(start, end + 2);
}

describe("styles/theme.css", () => {
  it("keeps the white palette dark surface dark enough for dark mode and resource bars", () => {
    const whiteBlock = blockFor(".theme-white");

    expect(whiteBlock).toContain("--color-50: 255 255 255;");
    expect(whiteBlock).toContain("--color-800: 40 40 40;");
    expect(whiteBlock).not.toContain("--color-800: 255 255 255;");
  });

  it("scopes white-theme light corrections so they do not override dark variants", () => {
    expect(themeCss).toContain(".light.theme-white .bg-theme-100\\/20");
    expect(themeCss).toContain(".light.theme-white .dark\\:bg-white\\/5");
    expect(themeCss).toContain(".light.theme-white .text-theme-800");
    expect(themeCss).not.toMatch(/(^|\n)\.theme-white \.dark\\:bg-white\\\/5/);
    expect(themeCss).not.toMatch(/(^|\n)\.theme-white \.text-theme-800/);
  });
});
