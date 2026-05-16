// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ChartDual from "./chart_dual";

function setSvgBounds(svg: SVGSVGElement) {
  svg.getBoundingClientRect = () =>
    ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("widgets/glances/components/chart_dual", () => {
  it("renders stacked dual-series SVG areas by default", () => {
    const { container } = render(
      <ChartDual
        dataPoints={[
          { a: 1, b: 2 },
          { a: 2, b: 1 },
        ]}
        formatter={(v) => `${v} MB`}
        label={["A", "B"]}
      />,
    );

    const svg = screen.getByTestId("glances-chart-dual-svg");
    expect(svg).toHaveAttribute("data-stack-mode", "stacked");
    expect(svg).toHaveAttribute("data-stack-offset", "none");
    expect(container.querySelector("linearGradient#colorA")).toBeInTheDocument();
    expect(container.querySelector("linearGradient#colorB")).toBeInTheDocument();

    const areas = container.querySelectorAll("path[data-series]");
    expect(areas).toHaveLength(2);
    expect(areas[0]).toHaveAttribute("data-series", "a");
    expect(areas[0]).toHaveAttribute("fill", "url(#colorA)");
    expect(areas[1]).toHaveAttribute("data-series", "b");
    expect(areas[1]).toHaveAttribute("fill", "url(#colorB)");
    expect(areas[0].getAttribute("d")).toMatch(/^M/);
    expect(areas[1].getAttribute("d")).toMatch(/^M/);
  });

  it("renders independent areas when stack ids differ", () => {
    render(
      <ChartDual
        dataPoints={[
          { a: 1, b: 2 },
          { a: 2, b: 1 },
        ]}
        formatter={(v) => String(v)}
        label={["Read", "Write"]}
        stack={["read", "write"]}
      />,
    );

    expect(screen.getByTestId("glances-chart-dual-svg")).toHaveAttribute("data-stack-mode", "independent");
  });

  it("supports expand stack offset and tooltip payload labels", () => {
    render(
      <ChartDual
        dataPoints={[
          { a: 1, b: 3 },
          { a: 2, b: 2 },
        ]}
        formatter={(v) => `${v}%`}
        label={["Used", "Free"]}
        stackOffset="expand"
      />,
    );

    const svg = screen.getByTestId("glances-chart-dual-svg") as unknown as SVGSVGElement;
    expect(svg).toHaveAttribute("data-stack-offset", "expand");
    setSvgBounds(svg);
    fireEvent.pointerMove(svg, { clientX: 0, clientY: 50 });

    expect(screen.getByText("1% Used")).toBeInTheDocument();
    expect(screen.getByText("3% Free")).toBeInTheDocument();
  });
});
