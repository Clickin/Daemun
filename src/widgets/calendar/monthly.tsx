import classNames from "classnames";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  addCalendarMonths,
  calendarDayOfMonth,
  calendarDayTimestamp,
  calendarMonth,
  compareCalendarDates,
  formatCalendarMonthTitle,
  getCalendarMonthGrid,
  getCalendarWeekdayNames,
  isCalendarWeekend,
  sameCalendarDay,
  startOfCalendarDay,
  subtractCalendarMonths,
  toCalendarDateKey,
} from "./date";
import Event, { compareDateTimezone } from "./event";

const cellStyle = "relative w-10 flex items-center justify-center flex-col";
const monthButton = "pl-6 pr-6 ml-2 mr-2 hover:bg-theme-100/20 dark:hover:bg-white/5 rounded-md cursor-pointer";

export function Day({ cellDate, events, colorVariants, showDate, setShowDate, currentDate }) {
  const filteredEvents = events?.filter((event) => compareDateTimezone(cellDate, event));

  const dayStyles = (displayDate) => {
    let style = "h-9 ";

    if (isCalendarWeekend(displayDate)) {
      // weekend style
      style += "text-red-500 ";
      // different month style
      style += calendarMonth(displayDate) !== calendarMonth(showDate) ? "text-red-500/40 " : "";
    } else if (calendarMonth(displayDate) !== calendarMonth(showDate)) {
      // different month style
      style += "text-gray-500 ";
    }

    // selected same day style
    style += sameCalendarDay(displayDate, showDate)
      ? "text-black-500 bg-theme-100/20 dark:bg-white/10 rounded-md "
      : "";

    if (sameCalendarDay(displayDate, currentDate)) {
      // today style
      style += "text-black-500 bg-theme-100/20 dark:bg-black/20 rounded-md ";
    } else {
      style += "hover:bg-theme-100/20 dark:hover:bg-white/5 rounded-md cursor-pointer";
    }

    return style;
  };

  return (
    <button
      key={`day-${toCalendarDateKey(cellDate)}`}
      type="button"
      className={classNames(dayStyles(cellDate), cellStyle)}
      style={{ width: "14%" }}
      onClick={() => setShowDate(cellDate)}
    >
      {calendarDayOfMonth(cellDate)}
      <span className="flex justify-center items-center absolute w-full -mb-6">
        {filteredEvents &&
          filteredEvents
            .slice(0, 4)
            .map((event) => (
              <span
                key={`${calendarDayTimestamp(event.date)}+${event.color}-${event.title}-${event.additional}`}
                className={classNames("inline-flex h-1 w-1 m-0.5 rounded-sm", colorVariants[event.color] ?? "gray")}
              />
            ))}
      </span>
    </button>
  );
}

export default function Monthly({ service, colorVariants, events, showDate, setShowDate, currentDate }) {
  const { widget } = service;
  const { i18n } = useTranslation();

  const firstDayInWeekCalendar = widget?.firstDayInWeek ? widget?.firstDayInWeek?.toLowerCase() : "monday";
  const dayNames = getCalendarWeekdayNames(i18n.language, firstDayInWeekCalendar);
  const monthGrid = useMemo(
    () => (showDate ? getCalendarMonthGrid(showDate, firstDayInWeekCalendar) : []),
    [showDate, firstDayInWeekCalendar],
  );

  if (!showDate) {
    return <div className="w-full text-center" />;
  }

  const eventsArray = Object.keys(events).map((eventKey) => events[eventKey]);
  eventsArray.sort((a, b) => compareCalendarDates(a.date, b.date));

  return (
    <div className="w-full text-center">
      <div className="flex-col">
        <span>
          <button
            type="button"
            onClick={() => setShowDate(startOfCalendarDay(subtractCalendarMonths(showDate, 1)))}
            className={classNames(monthButton)}
          >
            &lt;
          </button>
        </span>
        <span>
          <button type="button" onClick={() => setShowDate(startOfCalendarDay(currentDate))}>
            {formatCalendarMonthTitle(showDate, i18n.language)}
          </button>
        </span>
        <span>
          <button
            type="button"
            onClick={() => setShowDate(startOfCalendarDay(addCalendarMonths(showDate, 1)))}
            className={classNames(monthButton)}
          >
            &gt;
          </button>
        </span>
      </div>

      <div className="pl-1 pr-1 pb-1 w-full">
        <div className="flex justify-between flex-wrap">
          {dayNames.map((name) => (
            <span key={name} className={classNames(cellStyle)} style={{ width: "14%" }}>
              {name}
            </span>
          ))}
        </div>

        <div
          className={classNames(
            "flex justify-between flex-wrap pb-1",
            !eventsArray.length && widget?.integrations?.length && "animate-pulse",
          )}
        >
          {monthGrid.map((cellDate) => (
            <Day
              key={`day-${toCalendarDateKey(cellDate)}`}
              cellDate={cellDate}
              events={eventsArray}
              colorVariants={colorVariants}
              showDate={showDate}
              setShowDate={setShowDate}
              currentDate={currentDate}
            />
          ))}
        </div>

        <div className="flex flex-col">
          {eventsArray
            ?.filter((event) => compareDateTimezone(showDate, event))
            .slice(0, widget?.maxEvents ?? 10)
            .map((event) => (
              <Event
                key={`event-monthly-${event.title}-${event.date}-${event.additional}`}
                event={event}
                colorVariants={colorVariants}
                showDateColumn={widget?.showTime ?? false}
                showTime={widget?.showTime && compareDateTimezone(showDate, event)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
