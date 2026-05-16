import { bisector, max as d3Max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX } from "d3-shape";
import { PureComponent } from "react";
import type { PointerEvent } from "react";

import CustomTooltip from "./custom_tooltip";

interface ChartProps {
  dataPoints: Record<string, unknown>[];
  formatter: (value: unknown) => string;
  label: string[];
  max?: unknown;
}

interface ChartState {
  activeIndex: number | null;
}

interface Point {
  index: number;
  value: number;
  x: number;
}

const nearestPoint = bisector<Point, number>((point) => point.x).center;

function numericValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildPoints(dataPoints: Record<string, unknown>[]) {
  const x = scaleLinear()
    .domain([0, Math.max(dataPoints.length - 1, 1)])
    .range([0, 100]);

  return dataPoints.map((point, index) => ({
    index,
    value: numericValue(point.value),
    x: x(index),
  }));
}

function buildAreaPath(points: Point[]) {
  const yMax = Math.max(d3Max(points, (point) => point.value) ?? 0, 1);
  const y = scaleLinear().domain([0, yMax]).range([100, 0]);

  return (
    area<Point>()
      .x((point) => point.x)
      .y0(y(0))
      .y1((point) => y(point.value))
      .curve(curveMonotoneX)(points) ?? ""
  );
}

class Chart extends PureComponent<ChartProps, ChartState> {
  state: ChartState = {
    activeIndex: null,
  };

  handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const points = buildPoints(this.props.dataPoints);
    if (!points.length) {
      this.setState({ activeIndex: null });
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width || 100;
    const pointerX = clamp(((event.clientX - rect.left) / width) * 100, 0, 100);
    const activeIndex = points[nearestPoint(points, pointerX)]?.index ?? null;

    this.setState({ activeIndex });
  };

  handlePointerLeave = () => {
    this.setState({ activeIndex: null });
  };

  render() {
    const { dataPoints, formatter, label } = this.props;
    const points = buildPoints(dataPoints);
    const path = buildAreaPath(points);
    const activePoint = this.state.activeIndex !== null ? points[this.state.activeIndex] : undefined;

    return (
      <div className="absolute -top-10 -left-2 h-[calc(100%+3em)] w-[calc(100%+1em)] z-0">
        <div className="overflow-clip z-10 w-full h-full relative">
          <svg
            data-testid="glances-chart-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full"
            onPointerMove={this.handlePointerMove}
            onPointerLeave={this.handlePointerLeave}
          >
            <defs>
              <linearGradient id="color" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--color-500))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="rgb(var(--color-500))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            {path && (
              <path
                data-series="value"
                d={path}
                stroke="rgb(var(--color-500))"
                fill="url(#color)"
                fillOpacity={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {activePoint && (
            <div
              className="rounded-md text-xs p-0.5 absolute top-2 pointer-events-none"
              style={{ left: `${activePoint.x}%`, transform: "translateX(-50%)" }}
            >
              <CustomTooltip
                active
                formatter={formatter}
                payload={[{ name: label[0], value: dataPoints[activePoint.index]?.value }]}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default Chart;
