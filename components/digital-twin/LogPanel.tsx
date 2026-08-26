"use client";

import { useEffect, useRef, useState } from "react";
import { useTwinStore } from "@/lib/services/digital-twin/state.service";
import type { LogEntry } from "@/lib/services/digital-twin/types";

function formatTime(timeMs: number): string {
  const totalSec = 36000 + Math.floor(timeMs / 1000);
  const h = Math.floor(totalSec / 3600) % 24;
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const KIND_COLOR: Record<LogEntry["kind"], string> = {
  info: "text-slate-300",
  warn: "text-amber-300",
  success: "text-emerald-300",
  train: "text-sky-300",
};

export function LogPanel() {
  const log = useTwinStore((s) => s.log);
  const [collapsed, setCollapsed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [log]);

  return (
    <div className="w-[22rem] overflow-hidden rounded-xl bg-slate-900/95 shadow-lg ring-1 ring-slate-700 backdrop-blur">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
      >
        <span>Event Log {log.length > 0 && `(${log.length})`}</span>
        <span>{collapsed ? "▲" : "▼"}</span>
      </button>
      {!collapsed && (
        <div ref={boxRef} className="max-h-40 overflow-y-auto px-3 pb-2">
          {log.length === 0 && (
            <p className="py-1 font-mono text-[11px] text-slate-500">
              Simulation events will appear here…
            </p>
          )}
          {log.slice(-60).map((entry) => (
            <p key={entry.id} className={`font-mono text-[11px] leading-relaxed ${KIND_COLOR[entry.kind]}`}>
              <span className="text-slate-500">{formatTime(entry.timeMs)}</span> {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
