"use client";

import { useTwinStore } from "@/lib/services/digital-twin/state.service";
import type { Tool } from "@/lib/services/digital-twin/types";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "Click elements to inspect · drag trains, stations, track vertices" },
  { id: "track", label: "Track", hint: "Click to add points · Enter or double-click finishes the line" },
  { id: "station", label: "Station", hint: "Click anywhere on the map to place a station" },
  { id: "signal", label: "Signal", hint: "Click ON or near a line to place a signal at that spot" },
  { id: "pole", label: "OHE Pole", hint: "Click ON or near a line to place an OHE pole" },
  { id: "crossing", label: "Level Crossing", hint: "Click ON or near a line to place a level crossing" },
  { id: "train", label: "Train", hint: "Click ON or near a line to start a train there" },
  { id: "delete", label: "Delete", hint: "Click an element to remove it · deleting a line removes its equipment" },
];

const SPEEDS = [1, 5, 20];

export function Toolbar() {
  const tool = useTwinStore((s) => s.tool);
  const setTool = useTwinStore((s) => s.setTool);
  const running = useTwinStore((s) => s.running);
  const toggleRunning = useTwinStore((s) => s.toggleRunning);
  const speedMultiplier = useTwinStore((s) => s.speedMultiplier);
  const setSpeedMultiplier = useTwinStore((s) => s.setSpeedMultiplier);
  const resetNetwork = useTwinStore((s) => s.resetNetwork);

  const activeHint = TOOLS.find((t) => t.id === tool)?.hint;

  return (
    <div className="flex w-40 flex-col gap-3">
      <div className="panel flex flex-col gap-0.5 p-1.5">
        <span className="num px-2 pb-0.5 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Tools
        </span>
        {TOOLS.map(({ id, label, hint }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={hint}
            className={`px-3 py-1.5 text-left text-[13px] font-medium transition-colors ${
              tool === id
                ? "border border-signal-amber bg-signal-amber/10 text-signal-amber"
                : "text-muted-foreground hover:bg-panel-raised"
            }`}
          >
            {label}
          </button>
        ))}
        <p className="num mt-1 border border-border bg-panel-raised px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
          {activeHint}
        </p>
      </div>

      <div className="panel flex flex-col gap-0.5 p-1.5">
        <span className="num px-2 pb-0.5 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Simulation
        </span>
        <button
          onClick={toggleRunning}
          className={`px-3 py-1.5 text-left text-[13px] font-medium transition-colors ${
            running
              ? "text-muted-foreground hover:bg-panel-raised"
              : "border border-signal-green bg-signal-green/10 text-signal-green"
          }`}
        >
          {running ? "Pause" : "Play"}
        </button>
        <div className="flex gap-1 px-1 pb-1 pt-0.5">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => setSpeedMultiplier(speed)}
              className={`num flex-1 border px-1 py-1 text-[11px] font-semibold transition-colors ${
                speedMultiplier === speed
                  ? "border-signal-amber bg-signal-amber/10 text-signal-amber"
                  : "border-border text-muted-foreground hover:bg-panel-raised"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
        <button
          onClick={resetNetwork}
          className="px-3 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-panel-raised"
        >
          Reset Demo
        </button>
      </div>
    </div>
  );
}
