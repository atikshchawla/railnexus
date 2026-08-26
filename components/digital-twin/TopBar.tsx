"use client";

import Link from "next/link";
import { lineColor } from "./renderers";
import { useTwinStore } from "@/lib/services/digital-twin/state.service";

export function TopBar() {
  const tracks = useTwinStore((s) => s.network.tracks);
  const trains = useTwinStore((s) => s.network.trains);
  const running = useTwinStore((s) => s.running);
  const speedMultiplier = useTwinStore((s) => s.speedMultiplier);

  return (
    <header className="bg-slate-900 shadow-md">
      <div className="flex h-10 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-sky-500 text-[11px] font-black text-white">
            RN
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-bold text-white">RailNexus</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              Digital Twin — Network Simulation
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {Object.values(tracks).map((track) => (
            <span key={track.id} className="flex items-center gap-1.5 text-xs text-slate-300">
              <span
                className="inline-block h-2 w-4 rounded-full"
                style={{ backgroundColor: lineColor(track) }}
              />
              {track.name}
            </span>
          ))}
        </div>

      <Link
        href="/"
        className="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white shadow-md transition-colors hover:bg-sky-500"
      >
        GO back
      </Link>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              running ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                running ? "animate-pulse bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {running ? `LIVE · ${speedMultiplier}x` : "PAUSED"}
          </span>
        </div>
      </div>

      <div className="flex h-7 items-center gap-4 border-t border-slate-800 px-4 text-[10px]">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          Route colours
        </span>
        {Object.values(trains).map((train) => (
          <span key={train.id} className="flex items-center gap-1.5 text-slate-300">
            <span
              className="inline-block h-0.5 w-5 rounded-full"
              style={{ backgroundColor: train.color }}
            />
            {train.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="inline-block h-0.5 w-5 rounded-full bg-slate-400" />
          abandoned by diversion
        </span>
      </div>
    </header>
  );
}
