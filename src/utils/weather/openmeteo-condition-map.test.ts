import * as Icons from "react-icons/wi";
import { describe, expect, it } from "vitest";

import mapIcon from "./openmeteo-condition-map";

describe("utils/weather/openmeteo-condition-map", () => {
  it("maps known condition codes to day/night icons", () => {
    expect(mapIcon(95, "day")).toBe(Icons.WiDayThunderstorm);
    expect(mapIcon(95, "night")).toBe(Icons.WiNightAltThunderstorm);
  });

  it("maps rain shower and snow codes correctly", () => {
    expect(mapIcon(80, "day")).toBe(Icons.WiDaySprinkle);
    expect(mapIcon(80, "night")).toBe(Icons.WiNightAltSprinkle);
    expect(mapIcon(81, "day")).toBe(Icons.WiDayShowers);
    expect(mapIcon(81, "night")).toBe(Icons.WiNightAltShowers);
    expect(mapIcon(82, "day")).toBe(Icons.WiDayStormShowers);
    expect(mapIcon(82, "night")).toBe(Icons.WiNightAltStormShowers);
    expect(mapIcon(85, "day")).toBe(Icons.WiDaySnow);
    expect(mapIcon(85, "night")).toBe(Icons.WiNightAltSnow);
    expect(mapIcon(86, "day")).toBe(Icons.WiDaySnow);
    expect(mapIcon(86, "night")).toBe(Icons.WiNightAltSnow);
  });

  it("falls back to a default icon for unknown codes", () => {
    expect(mapIcon(999999, "day")).toBe(Icons.WiDaySunny);
  });
});
