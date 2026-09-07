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

const LOCATION_KINDS: DisasterKind[] = ["BROKEN_TRACK", "FLOODING", "OHE_FAULT"];

export function DemoControls() {
  const triggerDisaster = useTwinStore((s) => s.triggerDisaster);
  const activeEvents = useTwinStore((s) => s.activeEvents);
  const removeEvent = useTwinStore((s) => s.removeEvent);
  const clearEvents = useTwinStore((s) => s.clearEvents);
  const pendingDisaster = useTwinStore((s) => s.pendingDisaster);
  const setPendingDisaster = useTwinStore((s) => s.setPendingDisaster);
  const [hovered, setHovered] = useState<DisasterKind | null>(null);

  const hint = DISASTERS.find((d) => d.kind === hovered);
  const pendingHint = DISASTERS.find((d) => d.kind === pendingDisaster);

  const onButtonClick = (kind: DisasterKind) => {
    if (LOCATION_KINDS.includes(kind)) {
      setPendingDisaster(pendingDisaster === kind ? null : kind);
    } else {
      triggerDisaster(kind);
    }
  };

  return (
    <div className="panel w-[36rem] px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <span className="num text-[10px] uppercase tracking-wider text-muted-foreground">
          Trigger Event
          <span className="ml-2 normal-case tracking-normal text-muted-foreground">
            Broken Track / Flooding / OHE: click the button, then click a spot on a line
          </span>
        </span>
        {activeEvents.length > 0 && (
          <button
            onClick={clearEvents}
            className="num text-[10px] uppercase tracking-wider text-signal-red hover:opacity-80"
          >
            Clear all ({activeEvents.length})
          </button>
        )}
      </div>

      <div className="mt-1.5 flex gap-2">
        {DISASTERS.map(({ kind, label, color, description }) => (
          <button
            key={kind}
            onClick={() => onButtonClick(kind)}
            onMouseEnter={() => setHovered(kind)}
            onMouseLeave={() => setHovered(null)}
            title={description}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pendingDisaster === kind
                ? "border-signal-amber bg-signal-amber/10 text-signal-amber"
                : hovered === kind
                  ? "border-border bg-panel-raised text-foreground"
                  : "border-border text-muted-foreground hover:bg-panel-raised"
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </button>
        ))}
      </div>

      <p className="num mt-2 min-h-[2.6rem] border border-border bg-panel-raised px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
        {pendingHint
          ? `Placing: ${pendingHint.label} — move over a line and click to set the exact spot. Esc or the button again cancels.`
          : hint
            ? hint.description
            : activeEvents.length > 0
              ? "Hover a red marker on the map to highlight the affected line. Click × on an event to resolve it."
              : "Hover a button to see what it does. Click to trigger."}
      </p>

      {activeEvents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
          {activeEvents.map((event) => (
            <span
              key={event.id}
              className="flex items-center gap-1.5 border border-signal-red/30 bg-signal-red/10 px-2 py-1 text-[11px] font-medium text-signal-red"
            >
              {event.label}
              {typeof event.affectedTrains === "number" && (
                <span className="opacity-70">
                  · {event.affectedTrains} train{event.affectedTrains === 1 ? "" : "s"} affected
                </span>
              )}
              <button
                onClick={() => removeEvent(event.id)}
                title="Resolve this event — affected trains recover"
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded hover:bg-signal-red/20"
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
