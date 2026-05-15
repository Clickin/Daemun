import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { calendarDayTimestamp, compareCalendarDates, createCurrentCalendarDate, subtractCalendarDays } from "./date";
import Event, { compareDateTimezone } from "./event";

export default function Agenda({ service, colorVariants, events, showDate }) {
  const { widget } = service;
  const { t } = useTranslation();

  if (!showDate) {
    return <div className=" text-center" />;
  }

  const eventsArray = Object.keys(events)
    .filter((eventKey) => {
      const eventDate = events[eventKey].date;

      return (
        eventDate &&
        calendarDayTimestamp(subtractCalendarDays(showDate, widget?.previousDays ?? 0)) <=
          calendarDayTimestamp(eventDate)
      );
    })
    .map((eventKey) => events[eventKey])
    .sort((a, b) => compareCalendarDates(a.date, b.date))
    .slice(0, widget?.maxEvents ?? 10);

  if (!eventsArray.length) {
    return (
      <div className="text-center">
        <div className="pl-2 pr-2">
          <div className={classNames("flex flex-col", !eventsArray.length && !events.length && "animate-pulse")}>
            <Event
              key="no-event"
              event={{
                title: t("calendar.noEventsToday"),
                date: createCurrentCalendarDate(),
                color: "gray",
              }}
              colorVariants={colorVariants}
            />
          </div>
        </div>
      </div>
    );
  }

  const days = Array.from(new Set(eventsArray.map((e) => calendarDayTimestamp(e.date))));
  const eventsByDay = days.map((d) => eventsArray.filter((e) => calendarDayTimestamp(e.date) === d));

  return (
    <div className="pl-1 pr-1 pb-1">
      <div className={classNames("flex flex-col", !eventsArray.length && !events.length && "animate-pulse")}>
        {eventsByDay.map((eventsDay, i) => (
          <div key={days[i]}>
            {eventsDay.map((event, j) => (
              <Event
                key={`event-agenda-${event.title}-${event.date}-${event.additional}`}
                event={event}
                colorVariants={colorVariants}
                showDate={j === 0}
                showTime={widget?.showTime && compareDateTimezone(showDate, event)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
