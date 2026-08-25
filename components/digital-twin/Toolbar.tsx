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
      <div className="flex flex-col gap-0.5 rounded-xl bg-white/95 p-1.5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <span className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Tools
        </span>
        {TOOLS.map(({ id, label, hint }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={hint}
            className={`rounded-lg px-3 py-1.5 text-left text-[13px] font-medium transition-colors ${
              tool === id
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
        <p className="mt-1 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] leading-snug text-sky-900 ring-1 ring-sky-100">
          {activeHint}
        </p>
      </div>

      <div className="flex flex-col gap-0.5 rounded-xl bg-white/95 p-1.5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <span className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Simulation
        </span>
        <button
          onClick={toggleRunning}
          className={`rounded-lg px-3 py-1.5 text-left text-[13px] font-medium transition-colors ${
            running
              ? "text-slate-600 hover:bg-slate-100"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          {running ? "Pause" : "Play"}
        </button>
        <div className="flex gap-1 px-1 pb-1 pt-0.5">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => setSpeedMultiplier(speed)}
              className={`flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${
                speedMultiplier === speed
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
        <button
          onClick={resetNetwork}
          className="rounded-lg px-3 py-1.5 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Reset Demo
        </button>
      </div>
    </div>
  );
}
