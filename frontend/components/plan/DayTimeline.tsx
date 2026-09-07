"use client";

import { useState } from "react";
import type { TimelineBlock, TrainPath } from "@/lib/types";

interface DayTimelineProps {
  blocks: TimelineBlock[];
  trains: TrainPath[];
}

const deptColor: Record<string, string> = {
  Engg: "#B3261E",
  TRD: "#0B5FA5",
  "S&T": "#1E7A34",
};

const deptBg: Record<string, string> = {
  Engg: "rgba(179,38,30,0.15)",
  TRD: "rgba(11,95,165,0.15)",
  "S&T": "rgba(30,122,52,0.15)",
};

const hours = Array.from({ length: 25 }, (_, i) => i);

export default function DayTimeline({ blocks, trains }: DayTimelineProps) {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  const hourToPercent = (hour: number) => (hour / 24) * 100;
  const parseHour = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h + m / 60;
  };

  // Compute max row for stacking height
  const maxRow = Math.max(0, ...blocks.map((b) => b.row));
  const rowHeight = 28;
  const totalTrackHeight = (maxRow + 1) * rowHeight + 8;

  return (
    <div>
      {/* Hour markers */}
      <div className="relative h-5 mb-1">
        {hours.map((h) => (
          <span
            key={h}
            className="absolute text-[10px] text-text-secondary num"
            style={{ left: `${hourToPercent(h)}%`, transform: "translateX(-50%)" }}
          >
            {h.toString().padStart(2, "0")}
          </span>
        ))}
      </div>

      {/* Timeline track with stacking rows */}
      <div
        className="relative bg-surface-sunken border border-border-default"
        style={{ height: `${totalTrackHeight}px` }}
      >
        {/* Hour gridlines */}
        {hours.map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-border-default/60"
            style={{ left: `${hourToPercent(h)}%` }}
          />
        ))}

        {/* Block overlays — stacked by row */}
        {blocks.map((block) => (
          <div
            key={block.id}
            className="absolute cursor-pointer transition-opacity"
            style={{
              left: `${hourToPercent(block.startHour)}%`,
              width: `${hourToPercent(block.endHour - block.startHour)}%`,
              top: `${4 + block.row * rowHeight}px`,
              height: `${rowHeight - 4}px`,
              backgroundColor: deptBg[block.department],
              borderLeft: `2px solid ${deptColor[block.department]}`,
              opacity: hoveredBlock && hoveredBlock !== block.id ? 0.4 : 1,
            }}
            onMouseEnter={() => setHoveredBlock(block.id)}
            onMouseLeave={() => setHoveredBlock(null)}
            title={`${block.label} (${block.startHour}:00–${block.endHour}:00)`}
          >
            <span
              className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate"
              style={{ color: deptColor[block.department] }}
            >
              {block.label}
            </span>
          </div>
        ))}
      </div>

      {/* Train paths — passenger vs freight */}
      <div className="relative h-8 mt-1">
        {trains.map((train) => {
          const hour = parseHour(train.time);
          const isFreight = train.type === "Freight";
          const isConflict = blocks.some(
            (b) => hour >= b.startHour && hour <= b.endHour
          );
          return (
            <div
              key={train.id}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${hourToPercent(hour)}%`, transform: "translateX(-50%)" }}
              title={`${train.name} (${train.id}) — ${train.time} [${train.type}]`}
            >
              <div
                className={`w-px h-3 ${isConflict ? "bg-critical" : isFreight ? "bg-text-secondary/40" : "bg-brand/60"}`}
                style={{ borderStyle: isFreight ? "dashed" : "solid" }}
              />
              <span
                className={`text-[9px] num whitespace-nowrap ${
                  isConflict ? "text-critical font-semibold" : isFreight ? "text-text-secondary/60" : "text-brand/80"
                }`}
              >
                {train.id}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border-default text-[11px]">
        {Object.entries(deptColor).map(([dept, color]) => (
          <div key={dept} className="flex items-center gap-1.5">
            <div className="w-3 h-2" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span className="text-text-secondary">{dept}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 border-l border-border-default pl-2">
          <div className="w-3 border-t border-brand" />
          <span className="text-text-secondary">Passenger</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 border-t border-dashed border-text-secondary/40" />
          <span className="text-text-secondary">Freight</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-critical" />
          <span className="text-critical">Conflict</span>
        </div>
      </div>
    </div>
  );
}
