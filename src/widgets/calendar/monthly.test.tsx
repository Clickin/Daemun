// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  addCalendarMonths,
  createCalendarDate,
  createCurrentCalendarDate,
  formatCalendarMonthTitle,
  startOfCalendarDay,
  subtractCalendarMonths,
  toCalendarDateKey,
} from "./date";

const { EventStub, compareDateTimezoneStub } = vi.hoisted(() => ({
  EventStub: vi.fn<VitestMockProcedure>(({ event }) => <div data-testid="event">{event.title}</div>),
  compareDateTimezoneStub: vi.fn<VitestMockProcedure>(
    (date, event) => date.format("YYYY-MM-DD") === event.date.format("YYYY-MM-DD"),
  ),
}));

vi.mock("./event", () => ({
  default: EventStub,
  compareDateTimezone: compareDateTimezoneStub,
}));

import Monthly from "./monthly";

describe("widgets/calendar/monthly", () => {
  it("renders an empty placeholder when showDate is not set", () => {
    const { container } = render(
      <Monthly
        service={{ widget: {} }}
        colorVariants={{}}
        events={{}}
        showDate={null}
        setShowDate={() => {}}
        currentDate={createCurrentCalendarDate()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("navigates months and renders day events", () => {
    const setShowDate = vi.fn<VitestMockProcedure>();
    const showDate = startOfCalendarDay(createCalendarDate(2099, 2, 15));
    const currentDate = startOfCalendarDay(createCalendarDate(2099, 2, 4));
    const service = { widget: { maxEvents: 10, showTime: false } };

    const events = {
      e1: { title: "Today Event", date: createCalendarDate(2099, 2, 15, 10, 0), color: "zinc" },
      e2: { title: "Other Event", date: createCalendarDate(2099, 2, 16, 10, 0), color: "zinc" },
    };

    render(
      <Monthly
        service={service}
        colorVariants={{}}
        events={events}
        showDate={showDate}
        setShowDate={setShowDate}
        currentDate={currentDate}
      />,
    );

    expect(screen.getByText("Today Event")).toBeInTheDocument();
    expect(screen.queryByText("Other Event")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: ">" }));
    expect(setShowDate).toHaveBeenCalled();
    expect(toCalendarDateKey(setShowDate.mock.calls[0][0])).toBe(
      toCalendarDateKey(startOfCalendarDay(addCalendarMonths(showDate, 1))),
    );

    fireEvent.click(screen.getByRole("button", { name: "<" }));
    expect(toCalendarDateKey(setShowDate.mock.calls[1][0])).toBe(
      toCalendarDateKey(startOfCalendarDay(subtractCalendarMonths(showDate, 1))),
    );

    fireEvent.click(screen.getByRole("button", { name: formatCalendarMonthTitle(showDate, "en") }));
    expect(toCalendarDateKey(setShowDate.mock.calls[2][0])).toBe(toCalendarDateKey(startOfCalendarDay(currentDate)));
  });
});
