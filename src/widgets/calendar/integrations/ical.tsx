import ICAL from "ical.js";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import Error from "../../../components/services/widget/error";
import useWidgetAPI from "../../../utils/proxy/use-widget-api";
import {
  createCalendarDateFromJsDate,
  createCurrentCalendarDate,
  isBeforeCalendarDate,
  isValidCalendarDate,
  parseCalendarDate,
  toCalendarJsDate,
} from "../date";

function simpleHash(str) {
  let hash = 0;
  const prime = 31;

  for (let i = 0; i < str.length; i++) {
    hash = (hash * prime + str.charCodeAt(i)) % 2_147_483_647;
  }

  return Math.abs(hash).toString(36);
}

export default function Integration({ config, params, setEvents, hideErrors, timezone }) {
  const { t } = useTranslation();
  const { data: icalData, error: icalError } = useWidgetAPI(config, config.name, {
    refreshInterval: 300000, // 5 minutes
  });

  useEffect(() => {
    const { showName = false } = config?.params || {};
    let events = [];

    if (!icalError && icalData && !icalData.error) {
      if (!icalData.data) {
        icalData.error = { message: `'${config.name}': ${t("calendar.errorWhenLoadingData")}` };
        return;
      }

      const jCal = ICAL.parse(icalData.data);
      const vCalendar = new ICAL.Component(jCal);

      const buildEvent = (event, type) => {
        return {
          id: event.getFirstPropertyValue("uid"),
          type,
          title: event.getFirstPropertyValue("summary"),
          rrule: event.getFirstPropertyValue("rrule"),
          dtstart:
            event.getFirstPropertyValue("dtstart") ||
            event.getFirstPropertyValue("due") ||
            event.getFirstPropertyValue("completed") ||
            ICAL.Time.now(), // handles events without a date
          dtend:
            event.getFirstPropertyValue("dtend") ||
            event.getFirstPropertyValue("due") ||
            event.getFirstPropertyValue("completed") ||
            ICAL.Time.now(), // handles events without a date
          location: event.getFirstPropertyValue("location"),
          status: event.getFirstPropertyValue("status"),
          url: event.getFirstPropertyValue("url"),
        };
      };

      const getEvents = () => {
        const vEvents = vCalendar.getAllSubcomponents("vevent").map((event) => buildEvent(event, "vevent"));

        const vTodos = vCalendar.getAllSubcomponents("vtodo").map((todo) => buildEvent(todo, "vtodo"));

        return [...vEvents, ...vTodos];
      };

      events = getEvents();
      if (events.length === 0) {
        icalData.error = { message: `'${config.name}': ${t("calendar.noEventsFound")}` };
      }
    }

    const startDate = parseCalendarDate(params.start);
    const endDate = parseCalendarDate(params.end);

    if (icalError || events.length === 0 || !isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
      return;
    }

    const rangeStart = ICAL.Time.fromJSDate(toCalendarJsDate(startDate));
    const rangeEnd = ICAL.Time.fromJSDate(toCalendarJsDate(endDate));

    const getOcurrencesFromRange = (event) => {
      if (!event.rrule) {
        if (event.dtstart.compare(rangeStart) >= 0 && event.dtend.compare(rangeEnd) <= 0) {
          return [event.dtstart];
        }

        return [];
      }

      const iterator = event.rrule.iterator(event.dtstart);

      const occurrences = [];
      for (let next = iterator.next(); next && next.compare(rangeEnd) < 0; next = iterator.next()) {
        if (next.compare(rangeStart) < 0) {
          continue;
        }

        occurrences.push(next.clone());
      }

      return occurrences;
    };

    const eventsToAdd = [];
    events.forEach((event) => {
      const occurrences = getOcurrencesFromRange(event);

      occurrences.forEach((icalDate) => {
        const date = icalDate.toJSDate();

        const occurrenceTimestamp = date.getTime();
        const eventIdentifier =
          event.id ??
          simpleHash(
            `${event.title ?? ""}-${event.type ?? ""}-${event.status ?? ""}-${event.url ?? ""}-${event.location ?? ""}`,
          );
        const hash = simpleHash(`${eventIdentifier}-${occurrenceTimestamp}`);

        let title = event.title;
        if (showName) {
          title = `${config.name}: ${title}`;
        }

        const getIsCompleted = () => {
          if (event.type === "vtodo") {
            return event.status === "COMPLETED";
          }

          return isBeforeCalendarDate(createCalendarDateFromJsDate(date), createCurrentCalendarDate());
        };

        eventsToAdd[hash] = {
          title,
          date: createCalendarDateFromJsDate(date),
          color: config?.color ?? "zinc",
          isCompleted: getIsCompleted(),
          additional: event.location,
          type: "ical",
          url: event.url,
        };
      });
    });

    setEvents((prevEvents) => ({ ...prevEvents, ...eventsToAdd }));
  }, [icalData, icalError, config, params, setEvents, timezone, t]);

  const error = icalError ?? icalData?.error;
  return error && !hideErrors && <Error error={{ message: `${config.type}: ${error.message ?? error}` }} />;
}
