import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  calendarDayTimestamp,
  createCalendarDate,
  formatCalendarEventLabel,
  formatCalendarMonthTitle,
  getCalendarMonthGrid,
  getCalendarWeekdayNames,
  parseCalendarDate,
  sameCalendarDay,
  startOfCalendarDay,
  subtractCalendarDays,
  toCalendarDateKey,
} from "./date";

describe("widgets/calendar/date", () => {
  it("formats dates with the compact calendar labels expected by the widget", () => {
    const date = createCalendarDate(2099, 1, 2, 13, 5);

    expect(toCalendarDateKey(date)).toBe("2099-01-02");
    expect(formatCalendarMonthTitle(date, "en-US")).toBe("January 2099");
    expect(formatCalendarEventLabel(date, "en-US", true)).toBe("13:05");
    expect(formatCalendarEventLabel(date, "en-US", false)).toBe("Jan 2");
  });

  it("builds weekday headings and month cells from the configured first day", () => {
    expect(getCalendarWeekdayNames("en-US", "sunday")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

    const grid = getCalendarMonthGrid(createCalendarDate(2021, 3, 15), "sunday");
    expect(grid).toHaveLength(42);
    expect(toCalendarDateKey(grid[0])).toBe("2021-02-28");
    expect(toCalendarDateKey(grid[1])).toBe("2021-03-01");
    expect(toCalendarDateKey(grid[41])).toBe("2021-04-10");
  });

  it("compares and offsets dates at day granularity", () => {
    const selected = startOfCalendarDay(createCalendarDate(2099, 1, 2));
    const laterSameDay = createCalendarDate(2099, 1, 2, 23, 59);
    const nextDay = createCalendarDate(2099, 1, 3);

    expect(calendarDayTimestamp(selected)).toBe(calendarDayTimestamp(laterSameDay));
    expect(sameCalendarDay(selected, laterSameDay)).toBe(true);
    expect(sameCalendarDay(selected, nextDay)).toBe(false);
    expect(toCalendarDateKey(subtractCalendarDays(selected, 1))).toBe("2099-01-01");
    expect(toCalendarDateKey(addCalendarMonths(selected, 1))).toBe("2099-02-02");
  });

  it("falls back to local dates when a configured timezone is invalid", () => {
    expect(() => toCalendarDateKey(parseCalendarDate("2099-01-02T00:00:00.000Z", "Not/AZone"))).not.toThrow();
  });
});
