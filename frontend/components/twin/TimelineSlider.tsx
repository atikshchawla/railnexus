"use client";

import { useState } from "react";

interface TimelineBlock {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
  department: "Engg" | "TRD" | "S&T";
}

interface TrainPath {
  id: string;
  name: string;
  time: string;
  type: string;
}

interface TimelineSliderProps {
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

export default function TimelineSlider({ blocks, trains }: TimelineSliderProps) {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  const hourToPercent = (hour: number) => (hour / 24) * 100;

  // Parse train time to hour number
  const parseHour = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h + m / 60;
  };

  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h3 className="text-[15px] font-semibold text-text-primary">
          24-hour timeline
        </h3>
        <p className="text-[11px] text-text-secondary">
          Section Km 238–252, Ambala–Saharanpur
        </p>
      </div>

      <div className="px-4 py-3">
        {/* Hour markers */}
        <div className="relative h-5 mb-1">
          {hours.map((h) => (
            <span
              key={h}
              className="absolute text-[10px] text-text-secondary num"
              style={{
                left: `${hourToPercent(h)}%`,
                transform: "translateX(-50%)",
              }}
            >
              {h.toString().padStart(2, "0")}
            </span>
          ))}
        </div>

        {/* Timeline track */}
        <div className="relative h-10 bg-surface-sunken border border-border-default">
          {/* Hour gridlines */}
          {hours.map((h) => (
            <div
              key={h}
              className="absolute top-0 bottom-0 border-l border-border-default"
              style={{ left: `${hourToPercent(h)}%` }}
            />
          ))}

          {/* Block overlays */}
          {blocks.map((block) => (
            <div
              key={block.id}
              className="absolute top-1 bottom-1 cursor-pointer transition-opacity"
              style={{
                left: `${hourToPercent(block.startHour)}%`,
                width: `${hourToPercent(block.endHour - block.startHour)}%`,
                backgroundColor: deptBg[block.department],
                borderLeft: `2px solid ${deptColor[block.department]}`,
                opacity: hoveredBlock && hoveredBlock !== block.id ? 0.4 : 1,
              }}
              onMouseEnter={() => setHoveredBlock(block.id)}
              onMouseLeave={() => setHoveredBlock(null)}
            >
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-medium truncate px-1"
                style={{ color: deptColor[block.department] }}
              >
                {block.label}
              </span>
            </div>
          ))}
        </div>

        {/* Train paths row */}
        <div className="relative h-6 mt-1">
          {trains.map((train) => {
            const hour = parseHour(train.time);
            const isConflict = blocks.some(
              (b) => hour >= b.startHour && hour <= b.endHour
            );
            return (
              <div
                key={train.id}
                className="absolute top-0 flex flex-col items-center"
                style={{
                  left: `${hourToPercent(hour)}%`,
                  transform: "translateX(-50%)",
                }}
                title={`${train.name} (${train.id}) — ${train.time}`}
              >
                <div
                  className={`w-px h-3 ${
                    isConflict ? "bg-critical" : "bg-border-default"
                  }`}
                />
                <span
                  className={`text-[9px] num whitespace-nowrap ${
                    isConflict
                      ? "text-critical font-semibold"
                      : "text-text-secondary"
                  }`}
                >
                  {train.id}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border-default">
          {Object.entries(deptColor).map(([dept, color]) => (
            <div key={dept} className="flex items-center gap-1.5">
              <div
                className="w-3 h-2"
                style={{ backgroundColor: color, opacity: 0.7 }}
              />
              <span className="text-[11px] text-text-secondary">{dept}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-px h-3 bg-critical" />
            <span className="text-[11px] text-critical">Conflict</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-px h-3 bg-border-default" />
            <span className="text-[11px] text-text-secondary">Train path</span>
          </div>
        </div>
      </div>
    </div>
  );
}
