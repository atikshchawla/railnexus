import { useEffect, useRef, useState } from "react";
import { fmtTime, PATH_TABLE } from "@/lib/mock-data";

const DAY_START = 720; // 12:00
const DAY_END = 1080; // 18:00

export function Timeline({
  start,
  end,
  conflict,
  onChange,
}: {
  start: number;
  end: number;
  conflict: boolean;
  onChange: (s: number, e: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<"start" | "end" | null>(null);

  const pct = (m: number) => ((m - DAY_START) / (DAY_END - DAY_START)) * 100;

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const raw = DAY_START + ((e.clientX - r.left) / r.width) * (DAY_END - DAY_START);
      const m = Math.round(Math.max(DAY_START, Math.min(DAY_END, raw)) / 5) * 5;
      if (drag === "start") onChange(Math.min(m, end - 30), end);
      else onChange(start, Math.max(m, start + 30));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, start, end, onChange]);

  const hours = Array.from({ length: 7 }, (_, i) => DAY_START + i * 60);

  return (
    <div className="select-none">
      <div className="num mb-2 flex justify-between text-[10px] text-muted-foreground">
        {hours.map((h) => (
          <span key={h}>{fmtTime(h)}</span>
        ))}
      </div>

      <div ref={ref} className="relative h-16 border border-border bg-panel-raised">
        {hours.map((h) => (
          <span
            key={h}
            className="absolute top-0 h-full w-px bg-border"
            style={{ left: `${pct(h)}%` }}
          />
        ))}

        {PATH_TABLE.filter((p) => p.to > DAY_START && p.from < DAY_END).map((p) => (
          <div
            key={p.id}
            className="absolute bottom-1 h-4 border border-border bg-background"
            style={{
              left: `${pct(Math.max(p.from, DAY_START))}%`,
              width: `${pct(Math.min(p.to, DAY_END)) - pct(Math.max(p.from, DAY_START))}%`,
            }}
            title={p.service}
          >
            <span className="num block truncate px-1 text-[8px] leading-4 text-muted-foreground">
              {p.service}
            </span>
          </div>
        ))}

        <div
          className={`absolute top-1 h-8 border-2 ${
            conflict ? "border-signal-red bg-signal-red/20" : "border-signal-amber bg-signal-amber/15"
          }`}
          style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
        >
          <span
            className={`num block truncate px-1 text-[10px] leading-7 ${
              conflict ? "text-signal-red" : "text-signal-amber"
            }`}
          >
            BLOCK {fmtTime(start)}–{fmtTime(end)}
          </span>
        </div>

        {(["start", "end"] as const).map((h) => (
          <button
            key={h}
            onPointerDown={() => setDrag(h)}
            className={`absolute top-0 h-10 w-3 cursor-ew-resize border ${
              conflict ? "border-signal-red bg-signal-red/40" : "border-signal-amber bg-signal-amber/40"
            }`}
            style={{ left: `calc(${pct(h === "start" ? start : end)}% - 6px)` }}
            aria-label={`${h} handle`}
          />
        ))}
      </div>
    </div>
  );
}
