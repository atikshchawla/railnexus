"use client";

import Link from "next/link";
import { lineColor } from "./renderers";
import { useTwinStore } from "@/lib/services/digital-twin/state.service";
import { Lamp } from "@/components/ui-kit";

export function TopBar() {
  const tracks = useTwinStore((s) => s.network.tracks);
  const trains = useTwinStore((s) => s.network.trains);
  const running = useTwinStore((s) => s.running);
  const speedMultiplier = useTwinStore((s) => s.speedMultiplier);

  return (
    <header className="bg-panel">
      <div className="flex h-10 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Lamp tone={running ? "green" : "amber"} />
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-[0.2em] text-foreground">RailNexus</h1>
            <p className="num text-[10px] uppercase tracking-wider text-muted-foreground">
              Digital Twin — Network Simulation
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {Object.values(tracks).map((track) => (
            <span key={track.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2 w-4"
                style={{ backgroundColor: lineColor(track) }}
              />
              {track.name}
            </span>
          ))}
        </div>

        <Link
          href="/"
          className="border border-signal-amber px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-signal-amber transition-colors hover:bg-signal-amber/10"
        >
          GO BACK
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`num flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold ${
              running
                ? "border-signal-green text-signal-green"
                : "border-signal-amber text-signal-amber"
            }`}
          >
            <Lamp tone={running ? "green" : "amber"} />
            {running ? `LIVE · ${speedMultiplier}x` : "PAUSED"}
          </span>
        </div>
      </div>

      <div className="flex h-7 items-center gap-4 border-t border-border px-4 text-[10px]">
        <span className="num uppercase tracking-wider text-muted-foreground">
          Route colours
        </span>
        {Object.values(trains).map((train) => (
          <span key={train.id} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-0.5 w-5"
              style={{ backgroundColor: train.color }}
            />
            {train.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-0.5 w-5 bg-muted-foreground" />
          abandoned by diversion
        </span>
      </div>
    </header>
  );
}
