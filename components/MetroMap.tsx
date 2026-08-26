import { useEffect, useRef, useState } from "react";
import {
  LINES,
  pointAt,
  subPath,
  toPoints,
  nextStation,
  type MetroLine,
} from "@/lib/metro";
import { DEFECTS, TRAINS, LINE_LABELS } from "@/lib/mock-data";

type Props = {
  height?: number;
  selectedLine?: string | null;
  onSelectLine?: (lineId: string | null) => void;
  onSelectTrain?: (trainId: string, lineId: string) => void;
  corridor?: { lineId: string; t0: number; t1: number } | null;
  conflict?: boolean;
  showFreight?: boolean;
};

const VIEW = { x: 0, y: 0, w: 1000, h: 720 };

export function MetroMap({
  height = 460,
  selectedLine = null,
  onSelectLine,
  onSelectTrain,
  corridor = null,
  conflict = false,
  showFreight = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState(VIEW);
  const [t, setT] = useState(0);
  const [hover, setHover] = useState<{ id: string; line: string; next: string; x: number; y: number } | null>(
    null,
  );
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Non-passive wheel zoom anchored at cursor
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      setView((v) => {
        const k = Math.exp(e.deltaY * 0.0015);
        const w = Math.min(VIEW.w * 1.2, Math.max(160, v.w * k));
        const h = w * (VIEW.h / VIEW.w);
        return { x: v.x + (v.w - w) * px, y: v.y + (v.h - h) * py, w, h };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (k: number) =>
    setView((v) => {
      const w = Math.min(VIEW.w * 1.2, Math.max(160, v.w * k));
      const h = w * (VIEW.h / VIEW.w);
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });

  const dimmed = (id: string) => selectedLine !== null && selectedLine !== id && !(selectedLine === "blue" && id === "blue-branch");

  const corridorLine = corridor ? LINES.find((l) => l.id === corridor.lineId) : null;

  return (
    <div className="relative panel" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="h-full w-full cursor-grab select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          setView((v) => ({
            ...v,
            x: d.vx - ((e.clientX - d.x) / rect.width) * v.w,
            y: d.vy - ((e.clientY - d.y) / rect.height) * v.h,
          }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="4" />
          </pattern>
        </defs>

        <rect x={-2000} y={-2000} width={6000} height={6000} fill="var(--panel)" />
        {/* grid */}
        {Array.from({ length: 21 }).map((_, i) => (
          <line key={`gx${i}`} x1={i * 50} y1={-200} x2={i * 50} y2={920} stroke="var(--border)" strokeWidth={0.4} opacity={0.4} />
        ))}
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`gy${i}`} x1={-200} y1={i * 50} x2={1200} y2={i * 50} stroke="var(--border)" strokeWidth={0.4} opacity={0.4} />
        ))}

        {LINES.map((line) => (
          <g key={line.id} opacity={dimmed(line.id) ? 0.18 : 1}>
            <polyline
              points={toPoints(line.path)}
              fill="none"
              stroke={line.color}
              strokeWidth={selectedLine === line.id ? 6 : 4}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="cursor-pointer"
              onClick={() => onSelectLine?.(selectedLine === line.id ? null : line.id)}
            />
          </g>
        ))}

        {/* stations */}
        {LINES.map((line) =>
          line.stations.map((s) => {
            const p = line.path[s.at]!;
            return (
              <g key={`${line.id}-${s.name}`} opacity={dimmed(line.id) ? 0.18 : 1}>
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={s.interchange ? 5.5 : 3.5}
                  fill={s.interchange ? "var(--background)" : line.color}
                  stroke={s.interchange ? "var(--foreground)" : "var(--background)"}
                  strokeWidth={s.interchange ? 2 : 1}
                />
                {(selectedLine === line.id || s.interchange) && view.w < 1000 * 1.01 && (
                  <text
                    x={p[0] + 8}
                    y={p[1] - 6}
                    fill="var(--muted-foreground)"
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                  >
                    {s.name}
                  </text>
                )}
              </g>
            );
          }),
        )}

        {/* block corridor */}
        {corridorLine && (
          <g color={conflict ? "var(--signal-red)" : "var(--signal-amber)"}>
            <polyline
              points={toPoints(subPath(corridorLine.path, corridor!.t0, corridor!.t1))}
              fill="none"
              stroke="url(#hatch)"
              strokeWidth={16}
              opacity={0.55}
            />
            <polyline
              points={toPoints(subPath(corridorLine.path, corridor!.t0, corridor!.t1))}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeDasharray="10 6"
            />
          </g>
        )}

        {/* defect pins */}
        {DEFECTS.map((d) => {
          const line = LINES.find((l) => l.id === d.lineId)!;
          const p = pointAt(line.path, d.t);
          const active = !selectedLine || selectedLine === d.lineId;
          return (
            <g key={d.id} opacity={active ? 1 : 0.15}>
              <path
                d={`M ${p[0]} ${p[1]} l -6 -14 l 12 0 z`}
                fill={d.severity === "IMR" ? "var(--signal-red)" : "var(--signal-amber)"}
              />
              <circle
                cx={p[0]}
                cy={p[1] - 18}
                r={4}
                fill={d.severity === "IMR" ? "var(--signal-red)" : "var(--signal-amber)"}
                className={active && d.severity === "IMR" ? "lamp" : undefined}
              />
            </g>
          );
        })}

        {/* held freight */}
        {showFreight && (
          <g>
            <rect x={612} y={366} width={26} height={12} fill="var(--panel-raised)" stroke="var(--signal-amber)" />
            <text x={612} y={362} fill="var(--signal-amber)" fontSize={9} fontFamily="var(--font-mono)">
              FRT HELD
            </text>
          </g>
        )}

        {/* trains */}
        {TRAINS.map((tr) => {
          const line = LINES.find((l) => l.id === tr.lineId) as MetroLine;
          const raw = (tr.offset + t * tr.speed) % 2;
          const prog = raw > 1 ? 2 - raw : raw;
          const dir: 1 | -1 = raw > 1 ? -1 : 1;
          const p = pointAt(line.path, prog);
          const active = !selectedLine || selectedLine === tr.lineId;
          return (
            <g
              key={tr.id}
              opacity={active ? 1 : 0.12}
              className="cursor-pointer"
              onMouseEnter={() =>
                setHover({
                  id: tr.id,
                  line: LINE_LABELS[tr.lineId] ?? tr.lineId,
                  next: nextStation(line, prog, (dir * tr.dir) as 1 | -1).name,
                  x: p[0],
                  y: p[1],
                })
              }
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTrain?.(tr.id, tr.lineId);
              }}
            >
              <circle cx={p[0]} cy={p[1]} r={5} fill="var(--foreground)" stroke={line.color} strokeWidth={2} />
              {(selectedLine === tr.lineId || view.w < 600) && (
                <text x={p[0] + 7} y={p[1] + 12} fill="var(--foreground)" fontSize={8} fontFamily="var(--font-mono)">
                  {tr.id} {dir * tr.dir === 1 ? "UP" : "DN"}
                </text>
              )}
            </g>
          );
        })}

        {hover && (
          <g pointerEvents="none">
            <rect x={hover.x + 8} y={hover.y - 34} width={170} height={28} fill="var(--background)" stroke="var(--signal-amber)" />
            <text x={hover.x + 14} y={hover.y - 22} fill="var(--signal-amber)" fontSize={10} fontFamily="var(--font-mono)">
              {hover.id} · {hover.line}
            </text>
            <text x={hover.x + 14} y={hover.y - 11} fill="var(--muted-foreground)" fontSize={9} fontFamily="var(--font-mono)">
              NEXT: {hover.next}
            </text>
          </g>
        )}
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button onClick={() => zoomBy(0.75)} className="hairline num h-7 w-7 bg-panel-raised text-sm">
          +
        </button>
        <button onClick={() => zoomBy(1.33)} className="hairline num h-7 w-7 bg-panel-raised text-sm">
          −
        </button>
        <button onClick={() => setView(VIEW)} className="hairline num h-7 w-7 bg-panel-raised text-[9px]">
          RST
        </button>
      </div>
    </div>
  );
}
