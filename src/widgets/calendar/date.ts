import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export type CalendarDate = Dayjs;

type CalendarFirstDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
type DayjsWithTimezone = Dayjs & { $x?: { $timezone?: string } };

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

const calendarTimeZone = (date: CalendarDate) => (date as DayjsWithTimezone).$x?.$timezone;

const withCalendarTimeZone = (date: CalendarDate, timeZone?: string) => {
  if (!timeZone) {
    return date;
  }

  try {
    return date.tz(timeZone);
  } catch {
    return date;
  }
};

export const createCurrentCalendarDate = (timeZone?: string) =>
  timeZone ? withCalendarTimeZone(dayjs(), timeZone).startOf("day") : dayjs();

export const createCalendarDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  dayjs(new Date(year, month - 1, day, hour, minute));

export const parseCalendarDate = (value: string, timeZone?: string) => withCalendarTimeZone(dayjs(value), timeZone);

export const createCalendarDateFromJsDate = (date: Date) => dayjs(date);

export const isValidCalendarDate = (date: CalendarDate) => date.isValid();

export const isBeforeCalendarDate = (date: CalendarDate, reference: CalendarDate) =>
  date.valueOf() < reference.valueOf();

export const compareCalendarDates = (left: CalendarDate, right: CalendarDate) => left.valueOf() - right.valueOf();

export const startOfCalendarDay = (date: CalendarDate) => date.startOf("day");

export const addCalendarMonths = (date: CalendarDate, months: number) => date.add(months, "month");

export const subtractCalendarMonths = (date: CalendarDate, months: number) => date.subtract(months, "month");

export const subtractCalendarDays = (date: CalendarDate, days: number) => date.subtract(days, "day");

export const calendarDayTimestamp = (date: CalendarDate) => startOfCalendarDay(date).valueOf();

export const toCalendarDateKey = (date: CalendarDate) => date.format("YYYY-MM-DD");

export const toCalendarJsDate = (date: CalendarDate) => date.toDate();

export const sameCalendarDay = (left: CalendarDate, right: CalendarDate) =>
  toCalendarDateKey(startOfCalendarDay(left)) === toCalendarDateKey(startOfCalendarDay(right));

export const calendarDayOfMonth = (date: CalendarDate) => date.date();

export const calendarMonth = (date: CalendarDate) => date.month() + 1;

export const isCalendarWeekend = (date: CalendarDate) => {
  const day = date.day();

  return day === 0 || day === 6;
};

export const formatCalendarMonthTitle = (date: CalendarDate, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: calendarTimeZone(date),
    year: "numeric",
  }).format(toCalendarJsDate(date));

export const formatCalendarEventLabel = (date: CalendarDate, locale: string, showTime: boolean) =>
  new Intl.DateTimeFormat(
    locale,
    showTime
      ? {
          hour: "2-digit",
          hourCycle: "h23",
          minute: "2-digit",
          timeZone: calendarTimeZone(date),
        }
      : {
          day: "numeric",
          month: "short",
          timeZone: calendarTimeZone(date),
        },
  ).format(toCalendarJsDate(date));

export const getCalendarWeekdayNames = (locale: string, firstDay?: string) => {
  const firstDayIndex = firstDayIndexes[normalizeFirstDay(firstDay)];

  return Array.from({ length: 7 }, (_, index) => {
    const dayIndex = (firstDayIndex + index) % 7;
    const date = new Date(2020, 0, 5 + dayIndex, 12);

    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });
};

export const getCalendarMonthGrid = (showDate: CalendarDate, firstDay?: string) => {
  const firstOfMonth = createCalendarDate(showDate.year(), calendarMonth(showDate), 1);
  const firstDayIndex = firstDayIndexes[normalizeFirstDay(firstDay)];
  const leadingDays = (firstOfMonth.day() - firstDayIndex + 7) % 7;
  const gridStart = firstOfMonth.subtract(leadingDays, "day").startOf("day");

  return Array.from({ length: 42 }, (_, index) => gridStart.add(index, "day"));
};
