import { bisector, extent, max as d3Max } from "d3-array";
import { scaleLinear } from "d3-scale";
import {
  area,
  curveMonotoneX,
  stack as d3Stack,
  stackOffsetExpand,
  stackOffsetNone,
  stackOffsetSilhouette,
  stackOffsetWiggle,
} from "d3-shape";
import type { SeriesPoint } from "d3-shape";
import { PureComponent } from "react";
import type { PointerEvent } from "react";

import CustomTooltip from "./custom_tooltip";

interface ChartDualProps {
  dataPoints: Record<string, unknown>[];
  formatter: (value: unknown) => string;
  label: string[];
  max?: unknown;
  stack?: string[];
  stackOffset?: "expand" | "none" | "silhouette" | "wiggle";
}

interface ChartDualState {
  activeIndex: number | null;
}

interface Point {
  index: number;
  x: number;
}

interface IndependentPoint extends Point {
  value: number;
}

const keys = ["a", "b"] as const;
const nearestPoint = bisector<Point, number>((point) => point.x).center;

const stackOffsets = {
  expand: stackOffsetExpand,
  none: stackOffsetNone,
  silhouette: stackOffsetSilhouette,
  wiggle: stackOffsetWiggle,
};

function numericValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function xScaleFor(length: number) {
  return scaleLinear()
    .domain([0, Math.max(length - 1, 1)])
    .range([0, 100]);
}

function isStacked(stack?: string[]) {
  return (stack?.[0] ?? "1") === (stack?.[1] ?? "1");
}

function buildIndependentPaths(dataPoints: Record<string, unknown>[]) {
  const x = xScaleFor(dataPoints.length);
  const series = keys.map((key) =>
    dataPoints.map((point, index) => ({
      index,
      x: x(index),
      value: numericValue(point[key]),
    })),
  );
  const yMax = Math.max(d3Max(series.flat(), (point) => point.value) ?? 0, 1);
  const y = scaleLinear().domain([0, yMax]).range([100, 0]);
  const makeArea = area<IndependentPoint>()
    .x((point) => point.x)
    .y0(y(0))
    .y1((point) => y(point.value))
    .curve(curveMonotoneX);

  return series.map((points) => makeArea(points) ?? "");
}

function buildStackedPaths(dataPoints: Record<string, unknown>[], stackOffset: ChartDualProps["stackOffset"]) {
  const x = xScaleFor(dataPoints.length);
  const layers = d3Stack<Record<string, unknown>>()
    .keys([...keys])
    .value((point, key) => numericValue(point[key]))
    .offset(stackOffsets[stackOffset ?? "none"])(dataPoints);
  const yDomain = extent(layers.flatMap((layer) => layer.flatMap((point) => [point[0], point[1]])));
  const y = scaleLinear()
    .domain([Math.min(yDomain[0] ?? 0, 0), Math.max(yDomain[1] ?? 0, 1)])
    .range([100, 0]);
  const makeArea = area<SeriesPoint<Record<string, unknown>>>()
    .x((_point, index) => x(index))
    .y0((point) => y(point[0]))
    .y1((point) => y(point[1]))
    .curve(curveMonotoneX);

  return layers.map((layer) => makeArea(layer) ?? "");
}

function buildPoints(dataPoints: Record<string, unknown>[]) {
  const x = xScaleFor(dataPoints.length);
  return dataPoints.map((_point, index) => ({ index, x: x(index) }));
}

class ChartDual extends PureComponent<ChartDualProps, ChartDualState> {
  state: ChartDualState = {
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
    const { dataPoints, formatter, stack, label, stackOffset } = this.props;
    const stacked = isStacked(stack);
    const paths = stacked ? buildStackedPaths(dataPoints, stackOffset) : buildIndependentPaths(dataPoints);
    const points = buildPoints(dataPoints);
    const activePoint = this.state.activeIndex !== null ? points[this.state.activeIndex] : undefined;

    return (
      <div className="absolute -top-10 -left-2 h-[calc(100%+3em)] w-[calc(100%+1em)] z-0">
        <div className="overflow-clip z-10 w-full h-full relative">
          <svg
            data-testid="glances-chart-dual-svg"
            data-stack-mode={stacked ? "stacked" : "independent"}
            data-stack-offset={stackOffset ?? "none"}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full"
            onPointerMove={this.handlePointerMove}
            onPointerLeave={this.handlePointerLeave}
          >
            <defs>
              <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--color-800))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgb(var(--color-800))" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--color-500))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="rgb(var(--color-500))" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            {paths[0] && (
              <path
                data-series="a"
                d={paths[0]}
                stroke="rgb(var(--color-700))"
                fill="url(#colorA)"
                fillOpacity={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {paths[1] && (
              <path
                data-series="b"
                d={paths[1]}
                stroke="rgb(var(--color-500))"
                fill="url(#colorB)"
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
                payload={[
                  { name: label[0], value: dataPoints[activePoint.index]?.a },
                  { name: label[1], value: dataPoints[activePoint.index]?.b },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ChartDual;
