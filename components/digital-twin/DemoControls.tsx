"use client";

import { useState } from "react";
import { useTwinStore } from "@/lib/services/digital-twin/state.service";
import type { DisasterKind } from "@/lib/services/digital-twin/types";

const DISASTERS: { kind: DisasterKind; label: string; color: string; description: string }[] = [
  {
    kind: "BROKEN_TRACK",
    label: "Broken Track",
    color: "#dc2626",
    description:
      "Cracks a line (pulsing red X). Trains heading toward the break stop for a moment, then divert via another line to still reach their destination.",
  },
  {
    kind: "FLOODING",
    label: "Flooding",
    color: "#0284c7",
    description:
      "Floods a line (blue overlay). Trains on it react exactly like a broken track: stop, then divert via another line — or hold if no alternate exists.",
  },
  {
    kind: "SIGNAL_FAILURE",
    label: "Signal Failure",
    color: "#d97706",
    description:
      "A signal goes dark (grey with a red X). Trains approaching it stop and wait at caution until the signal is restored.",
  },
  {
    kind: "OHE_FAULT",
    label: "OHE Fault",
    color: "#ea580c",
    description:
      "Cuts overhead power on a line (orange bolt). Electric trains divert or hold; freight trains are diesel and keep running through the section.",
  },
  {
    kind: "MIXED_SCHEDULE",
    label: "Mixed Schedule",
    color: "#7c3aed",
    description:
      "Controller chaos: every train instantly reverses direction and half of them are re-slotted onto completely different lines.",
  },
];

export function DemoControls() {
  const triggerDisaster = useTwinStore((s) => s.triggerDisaster);
  const activeEvents = useTwinStore((s) => s.activeEvents);
  const removeEvent = useTwinStore((s) => s.removeEvent);
  const clearEvents = useTwinStore((s) => s.clearEvents);
  const [hovered, setHovered] = useState<DisasterKind | null>(null);

  const hint = DISASTERS.find((d) => d.kind === hovered);

  return (
    <div className="w-[36rem] rounded-xl bg-white/95 px-3.5 py-2.5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Trigger Event
          <span className="ml-2 normal-case tracking-normal text-slate-400">
            targets the selected line/signal, otherwise a random one
          </span>
        </span>
        {activeEvents.length > 0 && (
          <button
            onClick={clearEvents}
            className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 hover:text-rose-500"
          >
            Clear all ({activeEvents.length})
          </button>
        )}
      </div>

      <div className="mt-1.5 flex gap-2">
        {DISASTERS.map(({ kind, label, color, description }) => (
          <button
            key={kind}
            onClick={() => triggerDisaster(kind)}
            onMouseEnter={() => setHovered(kind)}
            onMouseLeave={() => setHovered(null)}
            title={description}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
              hovered === kind
                ? "bg-slate-200 text-slate-900 ring-slate-300"
                : "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200"
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </button>
        ))}
      </div>

      <p className="mt-2 min-h-[2.6rem] rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600 ring-1 ring-slate-100">
        {hint
          ? hint.description
          : activeEvents.length > 0
            ? "Click × on an event below to resolve it — affected trains recover automatically and return to their original route."
            : "Hover a button to see what it does. Click to trigger it now."}
      </p>

      {activeEvents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
          {activeEvents.map((event) => (
            <span
              key={event.id}
              className="flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-900 ring-1 ring-rose-100"
            >
              {event.label}
              {typeof event.affectedTrains === "number" && (
                <span className="text-rose-500">
                  · {event.affectedTrains} train{event.affectedTrains === 1 ? "" : "s"} affected
                </span>
              )}
              <button
                onClick={() => removeEvent(event.id)}
                title="Resolve this event — affected trains recover"
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded text-rose-500 hover:bg-rose-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
