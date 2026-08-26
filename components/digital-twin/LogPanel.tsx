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
  info: "text-muted-foreground",
  warn: "text-signal-amber",
  success: "text-signal-green",
  train: "text-signal-blue",
};

export function LogPanel() {
  const log = useTwinStore((s) => s.log);
  const [collapsed, setCollapsed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [log]);

  return (
    <div className="panel w-[22rem] overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="num flex w-full items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span>Event Log {log.length > 0 && `(${log.length})`}</span>
        <span>{collapsed ? "▲" : "▼"}</span>
      </button>
      {!collapsed && (
        <div ref={boxRef} className="max-h-40 overflow-y-auto px-3 pb-2">
          {log.length === 0 && (
            <p className="num py-1 text-[11px] text-muted-foreground">
              Simulation events will appear here…
            </p>
          )}
          {log.slice(-60).map((entry) => (
            <p key={entry.id} className={`num text-[11px] leading-relaxed ${KIND_COLOR[entry.kind]}`}>
              <span className="text-muted-foreground">{formatTime(entry.timeMs)}</span> {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
