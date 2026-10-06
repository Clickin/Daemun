import { DateTime } from "luxon";

export type CalendarDate = DateTime;

type CalendarFirstDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

const firstDayIndexes: Record<CalendarFirstDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const normalizeFirstDay = (firstDay?: string): CalendarFirstDay => {
  const normalized = firstDay?.toLowerCase();
  return normalized && normalized in firstDayIndexes ? (normalized as CalendarFirstDay) : "monday";
};

const withCalendarTimeZone = (date: CalendarDate, timeZone?: string) => {
  if (!timeZone) return date;
  const zoned = date.setZone(timeZone);
  return zoned.isValid ? zoned : date;
};

export const createCurrentCalendarDate = (timeZone?: string) => {
  const now = DateTime.now();
  return timeZone ? withCalendarTimeZone(now, timeZone).startOf("day") : now;
};

export const createCalendarDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  DateTime.local(year, month, day, hour, minute);

export const parseCalendarDate = (value: string, timeZone?: string) =>
  withCalendarTimeZone(DateTime.fromISO(value), timeZone);

export const createCalendarDateFromJsDate = (date: Date) => DateTime.fromJSDate(date);

export const isValidCalendarDate = (date: CalendarDate) => date.isValid;

export const isBeforeCalendarDate = (date: CalendarDate, reference: CalendarDate) =>
  date.toMillis() < reference.toMillis();

export const compareCalendarDates = (left: CalendarDate, right: CalendarDate) => left.toMillis() - right.toMillis();

export const startOfCalendarDay = (date: CalendarDate) => date.startOf("day");

export const addCalendarMonths = (date: CalendarDate, months: number) => date.plus({ months });

export const subtractCalendarMonths = (date: CalendarDate, months: number) => date.minus({ months });

export const subtractCalendarDays = (date: CalendarDate, days: number) => date.minus({ days });

export const calendarDayTimestamp = (date: CalendarDate) => startOfCalendarDay(date).toMillis();

export const toCalendarDateKey = (date: CalendarDate) => date.toISODate() ?? "";

export const toCalendarJsDate = (date: CalendarDate) => date.toJSDate();

export const sameCalendarDay = (left: CalendarDate, right: CalendarDate) =>
  toCalendarDateKey(startOfCalendarDay(left)) === toCalendarDateKey(startOfCalendarDay(right));

export const calendarDayOfMonth = (date: CalendarDate) => date.day;

export const calendarMonth = (date: CalendarDate) => date.month;

export const isCalendarWeekend = (date: CalendarDate) => date.weekday > 5;

export const formatCalendarMonthTitle = (date: CalendarDate, locale: string) =>
  date.setLocale(locale).toLocaleString({ month: "long", year: "numeric" });

export const formatCalendarEventLabel = (date: CalendarDate, locale: string, showTime: boolean) =>
  date
    .setLocale(locale)
    .toLocaleString(
      showTime
        ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
        : { day: "numeric", month: "short" },
    );

export const getCalendarWeekdayNames = (locale: string, firstDay?: string) => {
  const firstDayIndex = firstDayIndexes[normalizeFirstDay(firstDay)];

  return Array.from({ length: 7 }, (_, index) => {
    const dayIndex = (firstDayIndex + index) % 7;
    const date = new Date(2020, 0, 5 + dayIndex, 12);

    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });
};

export const getCalendarMonthGrid = (showDate: CalendarDate, firstDay?: string) => {
  const firstOfMonth = showDate.startOf("month");
  const firstDayIndex = firstDayIndexes[normalizeFirstDay(firstDay)];
  const leadingDays = ((firstOfMonth.weekday % 7) - firstDayIndex + 7) % 7;
  const gridStart = firstOfMonth.minus({ days: leadingDays }).startOf("day");

  return Array.from({ length: 42 }, (_, index) => gridStart.plus({ days: index }));
};
