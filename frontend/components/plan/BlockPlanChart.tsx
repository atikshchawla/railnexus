"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { Station, ChartBlock, TrainPath, DerivedConflict } from "@/lib/types";
import {
  scaleX, scaleY, inverseScaleX, clampView, formatTime,
  DAY_MS, HOUR_MS, getDeptColor, DEPT_COLORS, PRIORITY_BORDER, type PriorityTier,
} from "@/lib/chart-engine";

interface BlockPlanChartProps {
  stations: Station[];
  blocks: ChartBlock[];
  trains: TrainPath[];
  conflicts: DerivedConflict[];
  viewStart: number;
  viewEnd: number;
  onViewChange: (start: number, end: number) => void;
  selectedId: string | null;
  onSelect: (id: string, type: "block" | "train" | "conflict") => void;
  stationFilter: string | null;
  onStationFilter: (id: string | null) => void;
  nowMs: number;
}

const Y_PADDING = 20; // px padding top/bottom for km axis
const HEADER_H = 28;

export default function BlockPlanChart({
  stations,
  blocks,
  trains,
  conflicts,
  viewStart,
  viewEnd,
  onViewChange,
  selectedId,
  onSelect,
  stationFilter,
  onStationFilter,
  nowMs,
}: BlockPlanChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; viewStart: number; viewEnd: number } | null>(null);

  const CHART_HEIGHT = 480;

  // Filter stations by stationFilter
  const visibleStations = useMemo(() => {
    if (!stationFilter) return stations;
    const st = stations.find(s => s.id === stationFilter);
    if (!st) return stations;
    // Show the selected station and its neighbors
    const idx = stations.indexOf(st);
    const from = Math.max(0, idx - 1);
    const to = Math.min(stations.length - 1, idx + 1);
    return stations.slice(from, to + 1);
  }, [stations, stationFilter]);

  const minKm = Math.min(...visibleStations.map(s => s.km));
  const maxKm = Math.max(...visibleStations.map(s => s.km));

  const getX = useCallback((t: number) => scaleX(t, viewStart, viewEnd, chartWidth), [viewStart, viewEnd, chartWidth]);
  const getY = useCallback((km: number) => Y_PADDING + scaleY(km, minKm, maxKm, CHART_HEIGHT - 2 * Y_PADDING), [minKm, maxKm, CHART_HEIGHT]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width - 110); // subtract y-axis gutter
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // High-contrast observer
  useEffect(() => {
    const check = () => setIsHighContrast(document.documentElement.getAttribute("data-contrast") === "high");
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-contrast"] });
    return () => mo.disconnect();
  }, []);

  // Wheel zoom/pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left - 110; // offset for y-axis
    const cursorTime = inverseScaleX(mouseX, viewStart, viewEnd, chartWidth);

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
      const newRange = (viewEnd - viewStart) * zoomFactor;
      const ratio = (cursorTime - viewStart) / (viewEnd - viewStart);
      const newStart = cursorTime - ratio * newRange;
      const newEnd = cursorTime + (1 - ratio) * newRange;
      const [cs, ce] = clampView(newStart, newEnd);
      onViewChange(cs, ce);
    } else {
      // Pan
      const panAmount = (e.deltaX || e.deltaY) * ((viewEnd - viewStart) / chartWidth) * 1.5;
      const [cs, ce] = clampView(viewStart + panAmount, viewEnd + panAmount);
      onViewChange(cs, ce);
    }
  }, [viewStart, viewEnd, chartWidth, onViewChange]);

  // Mouse drag pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, viewStart, viewEnd };
  }, [viewStart, viewEnd]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const timeDelta = -dx * ((dragStartRef.current.viewEnd - dragStartRef.current.viewStart) / chartWidth);
    const [cs, ce] = clampView(dragStartRef.current.viewStart + timeDelta, dragStartRef.current.viewEnd + timeDelta);
    onViewChange(cs, ce);
  }, [isDragging, chartWidth, onViewChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Time grid ticks
  const timeRange = viewEnd - viewStart;
  const tickIntervalMs = timeRange <= 4 * HOUR_MS ? 15 * 60_000
    : timeRange <= 8 * HOUR_MS ? 30 * 60_000
    : HOUR_MS;
  const firstTick = Math.ceil(viewStart / tickIntervalMs) * tickIntervalMs;
  const ticks: number[] = [];
  for (let t = firstTick; t <= viewEnd; t += tickIntervalMs) ticks.push(t);

  // Block status → border style
  const blockBorderStyle = (status: string) => {
    switch (status) {
      case "proposed": return { dasharray: "6,4", width: 1.5 };
      case "approved": return { dasharray: "none", width: 1.5 };
      case "active": return { dasharray: "none", width: 2.5 };
      case "closed": return { dasharray: "none", width: 1 };
      default: return { dasharray: "none", width: 1.5 };
    }
  };

  const blockOpacity = (status: string) => status === "closed" ? 0.5 : 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-canvas border border-border-default overflow-hidden select-none"
      style={{ height: CHART_HEIGHT + HEADER_H, cursor: isDragging ? "grabbing" : "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Y-Axis gutter (fixed) */}
      <div className="absolute left-0 top-0 bottom-0 w-[110px] bg-surface border-r border-border-default z-20">
        <div className="h-[28px] border-b border-border-default bg-surface-sunken flex items-center px-2">
          <span className="text-[10px] font-medium text-text-secondary">Km / Station</span>
        </div>
        <svg width={110} height={CHART_HEIGHT} className="absolute top-[28px]">
          {stations.map(st => {
            const isFiltered = stationFilter === st.id;
            return (
              <g 
                key={st.id} 
                className="cursor-pointer" 
                onClick={() => onStationFilter(stationFilter === st.id ? null : st.id)}
              >
                <text
                  x={106}
                  y={getY(st.km) - 5}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={isFiltered ? 700 : 500}
                  fill={isFiltered ? "var(--brand-primary)" : "var(--text-primary)"}
                >
                {st.name}
              </text>
              <text
                x={106}
                y={getY(st.km) + 8}
                textAnchor="end"
                fontSize={9}
                fill={isFiltered ? "var(--brand-primary)" : "var(--text-secondary)"}
                fontFamily="var(--font-mono)"
              >
                Km {st.km}
              </text>
            </g>
          );
          })}
        </svg>
      </div>

      {/* X-Axis time header */}
      <div className="absolute left-[110px] top-0 right-0 h-[28px] bg-surface-sunken border-b border-border-default z-10 overflow-hidden">
        <svg width={chartWidth} height={HEADER_H}>
          {ticks.map(t => (
            <text
              key={t}
              x={getX(t)}
              y={18}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-secondary)"
              fontFamily="var(--font-mono)"
            >
              {formatTime(t)}
            </text>
          ))}
        </svg>
      </div>

      {/* SVG Chart Canvas */}
      <svg
        width={chartWidth}
        height={CHART_HEIGHT}
        className="absolute top-[28px] left-[110px]"
        style={{ overflow: "visible" }}
      >
        <defs>
          <style>
            {`
              .halo-text {
                paint-order: stroke fill;
                stroke: var(--bg-surface);
                stroke-width: 3px;
                stroke-linecap: round;
                stroke-linejoin: round;
              }
            `}
          </style>
          {/* Hatch patterns for high-contrast and shadow blocks */}
          <pattern id="hatch-engg" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--status-info)" strokeWidth="1.5" />
          </pattern>
          <pattern id="hatch-trd" width="6" height="6" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--status-warning)" strokeWidth="1.5" />
          </pattern>
          <pattern id="hatch-snt" width="6" height="6" patternTransform="rotate(90)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--status-success)" strokeWidth="1.5" />
          </pattern>
          {/* Cross-hatch for shadow blocks */}
          <pattern id="shadow-hatch-engg" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke="var(--status-info)" strokeWidth="1" opacity="0.5" />
            <line x1="8" y1="0" x2="0" y2="8" stroke="var(--status-info)" strokeWidth="1" opacity="0.5" />
          </pattern>
          <pattern id="shadow-hatch-trd" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke="var(--status-warning)" strokeWidth="1" opacity="0.5" />
            <line x1="8" y1="0" x2="0" y2="8" stroke="var(--status-warning)" strokeWidth="1" opacity="0.5" />
          </pattern>
          <pattern id="shadow-hatch-snt" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke="var(--status-success)" strokeWidth="1" opacity="0.5" />
            <line x1="8" y1="0" x2="0" y2="8" stroke="var(--status-success)" strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>

        {/* ── Layer 1: Grid ────────────────────────────────────── */}
        <g className="grid-layer" opacity={0.35}>
          {visibleStations.map(st => (
            <line key={`gy-${st.id}`} x1={0} x2={chartWidth} y1={getY(st.km)} y2={getY(st.km)} stroke="var(--border-default)" strokeWidth={1} />
          ))}
          {ticks.map(t => (
            <line key={`gx-${t}`} x1={getX(t)} x2={getX(t)} y1={0} y2={CHART_HEIGHT} stroke="var(--border-default)" strokeWidth={1}
              strokeDasharray={t % HOUR_MS === 0 ? "none" : "3,3"} />
          ))}
        </g>

        {/* ── Layer 2: Caution bands (proposed blocks — dashed outline only) */}
        <g className="caution-layer">
          {blocks.filter(b => b.status === "proposed" && !b.isShadow).map(block => {
            const x = getX(block.time_start);
            const y = getY(Math.min(block.km_start, block.km_end));
            const w = getX(block.time_end) - x;
            const h = getY(Math.max(block.km_start, block.km_end)) - y;
            return (
              <g key={`caution-${block.id}`} className="cursor-pointer" onClick={() => onSelect(block.id, "block")}>
                <rect x={x} y={y} width={Math.max(w, 4)} height={Math.max(h, 8)}
                  fill="none" stroke={getDeptColor(block.department)} strokeWidth={1.5} strokeDasharray="6,4" opacity={0.6} />
                <text x={x + 3} y={y + 11} fontSize={9} fill={getDeptColor(block.department)} fontWeight={500}>
                  {block.id}: {block.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Layer 3: Block bands (approved + active — solid fill) ─── */}
        <g className="blocks-layer">
          {blocks.filter(b => !b.isShadow && b.status !== "proposed").map(block => {
            const x = getX(block.time_start);
            const y = getY(Math.min(block.km_start, block.km_end));
            const w = getX(block.time_end) - x;
            const h = getY(Math.max(block.km_start, block.km_end)) - y;
            const bStyle = blockBorderStyle(block.status);
            const isSelected = selectedId === block.id;
            const pBorder = PRIORITY_BORDER[block.priorityTier as PriorityTier] || PRIORITY_BORDER["P4-low"];
            const fillVal = isHighContrast
              ? (DEPT_COLORS[block.department]?.hatch ?? "var(--text-secondary)")
              : getDeptColor(block.department);

            return (
              <g key={`block-${block.id}`} className="cursor-pointer" onClick={() => onSelect(block.id, "block")}
                opacity={blockOpacity(block.status)}>
                {/* Priority left-border accent */}
                {pBorder.width > 0 && (
                  <rect x={x} y={y} width={pBorder.width} height={Math.max(h, 8)}
                    fill={pBorder.color} />
                )}
                <rect
                  x={x + pBorder.width} y={y}
                  width={Math.max(w - pBorder.width, 4)} height={Math.max(h, 8)}
                  fill={fillVal} fillOpacity={isHighContrast ? 1 : 0.18}
                  stroke={getDeptColor(block.department)}
                  strokeWidth={isSelected ? 3 : bStyle.width}
                  strokeDasharray={bStyle.dasharray}
                />
                <text x={x + pBorder.width + 4} y={y + 12} fontSize={9} fill={getDeptColor(block.department)} fontWeight={600}
                  className="pointer-events-none halo-text">
                  {block.id}: {block.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Layer 4: Shadow blocks (hatch pattern + SHADOW tag) ──── */}
        <g className="shadow-layer">
          {blocks.filter(b => b.isShadow).map(block => {
            const x = getX(block.time_start);
            const y = getY(Math.min(block.km_start, block.km_end));
            const w = getX(block.time_end) - x;
            const h = getY(Math.max(block.km_start, block.km_end)) - y;
            const hatchId = block.department === "Engg" ? "shadow-hatch-engg"
              : block.department === "TRD" ? "shadow-hatch-trd" : "shadow-hatch-snt";
            const isSelected = selectedId === block.id;

            return (
              <g key={`shadow-${block.id}`} className="cursor-pointer" onClick={() => onSelect(block.id, "block")}>
                <rect x={x} y={y} width={Math.max(w, 4)} height={Math.max(h, 8)}
                  fill={`url(#${hatchId})`} stroke={getDeptColor(block.department)}
                  strokeWidth={isSelected ? 3 : 1} strokeDasharray="4,2" />
                <text x={x + 3} y={y + Math.max(h, 8) - 14} fontSize={8} fill={getDeptColor(block.department)} fontWeight={700}
                  className="pointer-events-none uppercase halo-text" letterSpacing="0.5">
                  Shadow
                </text>
                <text x={x + 3} y={y + Math.max(h, 8) - 4} fontSize={8} fill={getDeptColor(block.department)} fontWeight={500}
                  className="pointer-events-none halo-text">
                  {block.id}: {block.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Layer 5: Train string-lines ──────────────────────── */}
        <g className="trains-layer">
          {trains.map(train => {
            const pts = train.stops.map(s => `${getX(s.time)},${getY(s.km)}`).join(" ");
            const isSelected = selectedId === train.id;
            const firstStop = train.stops[0];
            const lastStop = train.stops[train.stops.length - 1];
            if (!firstStop || !lastStop) return null;

            // Find the first visible stop for label placement
            const labelX = getX(firstStop.time);
            const labelY = getY(firstStop.km);

            return (
              <g key={`train-${train.id}`} className="cursor-pointer" onClick={() => onSelect(train.id, "train")}>
                {/* Hit area */}
                <polyline points={pts} fill="none" stroke="transparent" strokeWidth={14} />
                {/* Visible line */}
                <polyline
                  points={pts} fill="none"
                  stroke="var(--text-primary)"
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={train.type === "Freight" ? "8,5" : "none"}
                  opacity={isSelected ? 1 : 0.55}
                />
                {/* Permanent label — every line must be labeled */}
                <text
                  x={labelX + 3} y={labelY - 5}
                  fontSize={9} fill="var(--text-primary)"
                  fontWeight={isSelected ? 700 : 500}
                  className="pointer-events-none halo-text"
                >
                  {train.id} {train.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Layer 6: Conflict diamonds (outlined, computed positions) ── */}
        <g className="conflicts-layer">
          {conflicts.map(c => {
            const cx = getX(c.intersectionTime);
            const cy = getY(c.intersectionKm);
            const isSelected = selectedId === c.id;
            const size = isSelected ? 10 : 7;

            return (
              <g key={`conflict-${c.id}`} className="cursor-pointer" onClick={() => onSelect(c.id, "conflict")}
                transform={`translate(${cx},${cy})`}>
                <polygon
                  points={`0,${-size} ${size},0 0,${size} ${-size},0`}
                  fill="var(--bg-surface)" stroke="var(--status-critical)"
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text x={size + 3} y={4} fontSize={8} fill="var(--status-critical)" fontWeight={600}
                  className="pointer-events-none halo-text">
                  {c.id}
                </text>
                {isSelected && (
                  <circle r={size + 5} fill="none" stroke="var(--status-critical)" strokeWidth={1} strokeDasharray="2,2" />
                )}
              </g>
            );
          })}
        </g>

        {/* ── Layer 7: NOW line ────────────────────────────────── */}
        {nowMs >= viewStart && nowMs <= viewEnd && (
          <g className="now-line">
            <line x1={getX(nowMs)} x2={getX(nowMs)} y1={0} y2={CHART_HEIGHT}
              stroke="var(--status-critical)" strokeWidth={2} />
            <rect x={getX(nowMs) - 16} y={0} width={32} height={14} fill="var(--status-critical)" rx={2} />
            <text x={getX(nowMs)} y={10} textAnchor="middle" fontSize={8} fill="#fff" fontWeight={700}
              fontFamily="var(--font-mono)">
              NOW
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
