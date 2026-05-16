// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Chart from "./chart";

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

describe("widgets/glances/components/chart", () => {
  it("renders a single-series SVG area chart with the existing gradient contract", () => {
    const { container } = render(
      <Chart dataPoints={[{ value: 0 }, { value: 40 }, { value: 20 }]} formatter={(v) => `${v}%`} label={["CPU"]} />,
    );

    const svg = screen.getByTestId("glances-chart-svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(container.querySelector("linearGradient#color")).toBeInTheDocument();

    const area = container.querySelector('path[data-series="value"]');
    expect(area).toBeInTheDocument();
    expect(area).toHaveAttribute("fill", "url(#color)");
    expect(area).toHaveAttribute("stroke", "rgb(var(--color-500))");
    expect(area?.getAttribute("d")).toMatch(/^M/);
  });

  it("shows the formatted nearest point in the existing tooltip component", () => {
    render(
      <Chart dataPoints={[{ value: 0 }, { value: 40 }, { value: 20 }]} formatter={(v) => `${v}%`} label={["CPU"]} />,
    );

    const svg = screen.getByTestId("glances-chart-svg") as unknown as SVGSVGElement;
    setSvgBounds(svg);
    fireEvent.pointerMove(svg, { clientX: 48, clientY: 50 });

    expect(screen.getByText("40% CPU")).toBeInTheDocument();
  });
});
