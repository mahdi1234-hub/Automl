"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveHeatMap } from "@nivo/heatmap";
import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import { ResponsiveRadar } from "@nivo/radar";
import type { ChartData } from "@/lib/types";

const nivoTheme = {
  background: "transparent",
  text: { fontSize: 11, fill: "#9C9789" },
  axis: {
    domain: { line: { stroke: "#2C2B27", strokeWidth: 1 } },
    legend: { text: { fontSize: 12, fill: "#9C9789" } },
    ticks: {
      line: { stroke: "#2C2B27", strokeWidth: 1 },
      text: { fontSize: 10, fill: "#6B675E" },
    },
  },
  grid: { line: { stroke: "#2C2B27", strokeWidth: 1 } },
  legends: { text: { fontSize: 11, fill: "#9C9789" } },
  tooltip: {
    container: {
      background: "#22211E",
      color: "#F5F0EB",
      fontSize: 12,
      borderRadius: 8,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      border: "1px solid #2C2B27",
    },
  },
};

const copperColors = [
  "#C17F59",
  "#C9A96E",
  "#8A9A7B",
  "#D4A07A",
  "#C4704E",
  "#DFC08A",
  "#E8B894",
  "#6B675E",
  "#D9D2CA",
  "#9C9789",
];

export default function InlineChart({ chart }: { chart: ChartData }) {
  return (
    <div className="my-4 rounded-xl border border-[#2C2B27] bg-[#1A1917] p-4">
      {chart.title && (
        <h4 className="font-display text-sm text-[#D4A07A] mb-3">
          {chart.title}
        </h4>
      )}
      <div className="h-[300px] w-full">{renderChart(chart)}</div>
    </div>
  );
}

function renderChart(chart: ChartData) {
  switch (chart.type) {
    case "bar":
      return renderBarChart(chart);
    case "line":
      return renderLineChart(chart);
    case "pie":
      return renderPieChart(chart);
    case "heatmap":
      return renderHeatMap(chart);
    case "scatter":
      return renderScatterPlot(chart);
    case "radar":
      return renderRadarChart(chart);
    default:
      return renderBarChart(chart);
  }
}

function renderBarChart(chart: ChartData) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <p className="text-[#6B675E]">No data</p>;

  const keys = Object.keys(data[0] || {}).filter((k) => k !== "id" && k !== "label" && k !== "name" && k !== "category");

  return (
    <ResponsiveBar
      data={data}
      keys={keys}
      indexBy={data[0]?.name ? "name" : data[0]?.label ? "label" : data[0]?.category ? "category" : "id"}
      margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
      padding={0.3}
      colors={copperColors}
      theme={nivoTheme}
      borderRadius={4}
      borderColor={{ from: "color", modifiers: [["darker", 1.6]] }}
      axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: -30 }}
      axisLeft={{ tickSize: 5, tickPadding: 5 }}
      enableLabel={false}
      animate={true}
    />
  );
}

function renderLineChart(chart: ChartData) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <p className="text-[#6B675E]">No data</p>;

  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
      xScale={{ type: "point" }}
      yScale={{ type: "linear", min: "auto", max: "auto" }}
      colors={copperColors}
      theme={nivoTheme}
      pointSize={8}
      pointColor={{ from: "color" }}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      enableArea={true}
      areaOpacity={0.1}
      useMesh={true}
      animate={true}
    />
  );
}

function renderPieChart(chart: ChartData) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <p className="text-[#6B675E]">No data</p>;

  return (
    <ResponsivePie
      data={data}
      margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
      innerRadius={0.5}
      padAngle={0.7}
      cornerRadius={3}
      colors={copperColors}
      theme={nivoTheme}
      borderWidth={1}
      borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
      arcLinkLabelsTextColor="#9C9789"
      arcLinkLabelsThickness={2}
      arcLinkLabelsColor={{ from: "color" }}
      arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
      animate={true}
    />
  );
}

function renderHeatMap(chart: ChartData) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <p className="text-[#6B675E]">No data</p>;

  return (
    <ResponsiveHeatMap
      data={data}
      margin={{ top: 60, right: 30, bottom: 30, left: 60 }}
      theme={nivoTheme}
      colors={{
        type: "sequential",
        scheme: "oranges",
      }}
      animate={true}
    />
  );
}

function renderScatterPlot(chart: ChartData) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <p className="text-[#6B675E]">No data</p>;

  return (
    <ResponsiveScatterPlot
      data={data}
      margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
      xScale={{ type: "linear", min: "auto", max: "auto" }}
      yScale={{ type: "linear", min: "auto", max: "auto" }}
      colors={copperColors}
      theme={nivoTheme}
      nodeSize={8}
      useMesh={true}
      animate={true}
    />
  );
}

function renderRadarChart(chart: ChartData) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <p className="text-[#6B675E]">No data</p>;

  const keys = Object.keys(data[0] || {}).filter((k) => k !== "metric" && k !== "label" && k !== "name");

  return (
    <ResponsiveRadar
      data={data}
      keys={keys}
      indexBy="metric"
      maxValue="auto"
      margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
      colors={copperColors}
      theme={nivoTheme}
      borderWidth={2}
      borderColor={{ from: "color" }}
      gridLevels={5}
      gridShape="circular"
      dotSize={8}
      dotColor={{ theme: "background" }}
      dotBorderWidth={2}
      dotBorderColor={{ from: "color" }}
      fillOpacity={0.15}
      blendMode="multiply"
      animate={true}
    />
  );
}
