import { describe, expect, it } from "vitest";

import { addDaemunFormatters } from "./i18n/formatters";

function getRateFormatter() {
  let rateFormatter;

  addDaemunFormatters({
    t: (key) => key,
    services: {
      formatter: {
        add(name, formatter) {
          if (name === "rate") rateFormatter = formatter;
        },
      },
    },
  });

  return rateFormatter;
}

describe("rate formatter", () => {
  const formatRate = getRateFormatter();

  it.each([
    ["zero bytes", 0, { binary: true, bits: false, decimals: 1 }, "0 B/s"],
    ["decimal bytes", 15_000, { binary: false, bits: false, decimals: 1 }, "15.0 kB/s"],
    ["binary bytes", 512, { binary: true, bits: false, decimals: 1 }, "512.0 B/s"],
    ["binary kibibytes", 15 * 1024, { binary: true, bits: false, decimals: 1 }, "15.0 kiB/s"],
    ["binary mebibytes", 15 * 1024 ** 2, { binary: true, bits: false, decimals: 1 }, "15.0 MiB/s"],
    ["binary gibibytes", 2 * 1024 ** 3, { binary: true, bits: false, decimals: 1 }, "2.0 GiB/s"],
    ["binary bits", 15 * 1024, { binary: true, bits: true, decimals: 1 }, "15.0 kibit/s"],
  ])("formats %s", (_description, value, options, expected) => {
    expect(formatRate(value, "en", options)).toBe(expected);
  });
});
