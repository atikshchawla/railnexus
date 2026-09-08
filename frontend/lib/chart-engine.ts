/**
 * chart-engine.ts — Pure functions for the Time-vs-Distance chart.
 * No React, no DOM. This is the mathematical core.
 */

import type { ChartBlock, TrainPath, TrainStop, DerivedConflict } from "./types";

// ─── Constants ───────────────────────────────────────────────────────
export const DAY_MS = 24 * 3600_000;
export const HOUR_MS = 3600_000;
export const MIN_VIEW_MS = 60 * 60_000;   // 60 min minimum zoom
export const MAX_VIEW_MS = 1440 * 60_000;  // 1440 min (full day) max zoom

// ─── Priority Tier ───────────────────────────────────────────────────
export type PriorityTier = "P1-critical" | "P2-high" | "P3-medium" | "P4-low";

export function computePriorityTier(urgencyScore: number): PriorityTier {
  if (urgencyScore >= 85) return "P1-critical";
  if (urgencyScore >= 60) return "P2-high";
  if (urgencyScore >= 35) return "P3-medium";
  return "P4-low";
}

export const PRIORITY_BORDER: Record<PriorityTier, { width: number; color: string }> = {
  "P1-critical": { width: 3, color: "var(--status-critical)" },
  "P2-high":     { width: 2, color: "var(--status-warning)" },
  "P3-medium":   { width: 1, color: "var(--status-info)" },
  "P4-low":      { width: 0, color: "transparent" },
};

// ─── Scale Functions ─────────────────────────────────────────────────

/** Linear map: time (ms since midnight) → pixel X */
export function scaleX(
  timeMs: number,
  viewStart: number,
  viewEnd: number,
  chartWidth: number
): number {
  const range = viewEnd - viewStart;
  if (range <= 0) return 0;
  return ((timeMs - viewStart) / range) * chartWidth;
}

/** Linear map: km (real chainage) → pixel Y. Proportional to real distance. */
export function scaleY(
  km: number,
  minKm: number,
  maxKm: number,
  chartHeight: number
): number {
  const range = maxKm - minKm;
  if (range <= 0) return 0;
  return ((km - minKm) / range) * chartHeight;
}

/** Inverse: pixel X → time ms */
export function inverseScaleX(
  px: number,
  viewStart: number,
  viewEnd: number,
  chartWidth: number
): number {
  if (chartWidth <= 0) return viewStart;
  return viewStart + (px / chartWidth) * (viewEnd - viewStart);
}

// ─── View Clamping ───────────────────────────────────────────────────

export function clampView(
  start: number,
  end: number
): [number, number] {
  let s = start;
  let e = end;
  const range = e - s;

  // Enforce min/max zoom
  if (range < MIN_VIEW_MS) {
    const mid = (s + e) / 2;
    s = mid - MIN_VIEW_MS / 2;
    e = mid + MIN_VIEW_MS / 2;
  }
  if (range > MAX_VIEW_MS) {
    const mid = (s + e) / 2;
    s = mid - MAX_VIEW_MS / 2;
    e = mid + MAX_VIEW_MS / 2;
  }

  // Keep within day bounds
  if (s < 0) { e -= s; s = 0; }
  if (e > DAY_MS) { s -= (e - DAY_MS); e = DAY_MS; }
  if (s < 0) s = 0;

  return [s, e];
}

// ─── Time Formatting ─────────────────────────────────────────────────

/** Convert ms since midnight → "HH:MM" */
export function formatTime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// ─── Geometric Conflict Detection (§4) ──────────────────────────────

interface Segment {
  x1: number; y1: number; // (time, km) of stop A
  x2: number; y2: number; // (time, km) of stop B
}

interface Rect {
  xMin: number; xMax: number; // time_start, time_end
  yMin: number; yMax: number; // km_start, km_end
}

/**
 * Liang-Barsky line-clipping algorithm.
 * Tests if a line segment intersects a rectangle.
 * Returns the intersection midpoint if it does, or null.
 */
function liangBarsky(seg: Segment, rect: Rect): { time: number; km: number } | null {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;

  const p = [-dx, dx, -dy, dy];
  const q = [
    seg.x1 - rect.xMin,
    rect.xMax - seg.x1,
    seg.y1 - rect.yMin,
    rect.yMax - seg.y1,
  ];

  let tMin = 0;
  let tMax = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // Parallel and outside
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        tMin = Math.max(tMin, t);
      } else {
        tMax = Math.min(tMax, t);
      }
    }
  }

  if (tMin > tMax) return null;

  // Compute midpoint of the clipped segment inside the rectangle
  const tMid = (tMin + tMax) / 2;
  return {
    time: seg.x1 + tMid * dx,
    km: seg.y1 + tMid * dy,
  };
}

/**
 * Rectangle-rectangle intersection test.
 * Returns the center of the overlap if it exists, or null.
 */
function rectIntersection(a: Rect, b: Rect): { time: number; km: number; overlapMinutes: number } | null {
  const xMin = Math.max(a.xMin, b.xMin);
  const xMax = Math.min(a.xMax, b.xMax);
  const yMin = Math.max(a.yMin, b.yMin);
  const yMax = Math.min(a.yMax, b.yMax);

  if (xMin >= xMax || yMin >= yMax) return null;

  return {
    time: (xMin + xMax) / 2,
    km: (yMin + yMax) / 2,
    overlapMinutes: Math.round((xMax - xMin) / 60_000),
  };
}

/**
 * Compute all derived conflicts from blocks and trains.
 * This is the ONLY way conflicts appear — never manually placed.
 */
export function computeConflicts(
  blocks: ChartBlock[],
  trains: TrainPath[]
): DerivedConflict[] {
  const conflicts: DerivedConflict[] = [];
  let conflictIdx = 1;

  // 1. Train-vs-Block intersections
  for (const block of blocks) {
    const blockRect: Rect = {
      xMin: block.time_start,
      xMax: block.time_end,
      yMin: Math.min(block.km_start, block.km_end),
      yMax: Math.max(block.km_start, block.km_end),
    };

    for (const train of trains) {
      for (let i = 0; i < train.stops.length - 1; i++) {
        const s1 = train.stops[i];
        const s2 = train.stops[i + 1];
        const seg: Segment = {
          x1: s1.time, y1: s1.km,
          x2: s2.time, y2: s2.km,
        };

        const hit = liangBarsky(seg, blockRect);
        if (hit) {
          // Check for duplicates (same block+train)
          const exists = conflicts.some(
            (c) => c.blockId === block.id && c.trainId === train.id
          );
          if (!exists) {
            const overlapTimeStart = Math.max(blockRect.xMin, Math.min(s1.time, s2.time));
            const overlapTimeEnd = Math.min(blockRect.xMax, Math.max(s1.time, s2.time));
            conflicts.push({
              id: `CONF-${String(conflictIdx++).padStart(3, "0")}`,
              blockId: block.id,
              trainId: train.id,
              km_start: blockRect.yMin,
              km_end: blockRect.yMax,
              time_start: overlapTimeStart,
              time_end: overlapTimeEnd,
              overlapMinutes: Math.max(1, Math.round((overlapTimeEnd - overlapTimeStart) / 60_000)),
              intersectionKm: hit.km,
              intersectionTime: hit.time,
              priorityTier: block.priorityTier || "P3-medium",
              affectedTrainName: train.name,
              affectedBlockDesc: block.description,
              candidate_resolutions: [
                `Hold ${train.id} at nearest station for ${Math.max(1, Math.round((overlapTimeEnd - overlapTimeStart) / 60_000))} mins`,
                `Reschedule block ${block.id} after ${train.id} passes`,
                `Route ${train.id} via loop line to bypass block`,
              ],
            });
          }
        }
      }
    }
  }

  // 2. Block-vs-Block overlaps (non-shadow, different departments)
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.isShadow || b.isShadow) continue;
      if (a.department === b.department) continue;

      const hit = rectIntersection(
        { xMin: a.time_start, xMax: a.time_end, yMin: Math.min(a.km_start, a.km_end), yMax: Math.max(a.km_start, a.km_end) },
        { xMin: b.time_start, xMax: b.time_end, yMin: Math.min(b.km_start, b.km_end), yMax: Math.max(b.km_start, b.km_end) },
      );

      if (hit) {
        conflicts.push({
          id: `CONF-${String(conflictIdx++).padStart(3, "0")}`,
          blockId: a.id,
          otherBlockId: b.id,
          km_start: Math.max(Math.min(a.km_start, a.km_end), Math.min(b.km_start, b.km_end)),
          km_end: Math.min(Math.max(a.km_start, a.km_end), Math.max(b.km_start, b.km_end)),
          time_start: Math.max(a.time_start, b.time_start),
          time_end: Math.min(a.time_end, b.time_end),
          overlapMinutes: hit.overlapMinutes,
          intersectionKm: hit.km,
          intersectionTime: hit.time,
          priorityTier: "P2-high",
          affectedBlockDesc: `${a.department} ${a.description} vs ${b.department} ${b.description}`,
          candidate_resolutions: [
            `Stagger: shift ${b.id} to start after ${a.id} ends`,
            `Merge into single integrated block`,
            `Cancel lower-priority block ${a.priorityTier > b.priorityTier ? a.id : b.id}`,
          ],
        });
      }
    }
  }

  return conflicts;
}

// ─── Department Colors ───────────────────────────────────────────────

export const DEPT_COLORS: Record<string, { stroke: string; fill: string; hatch: string; label: string }> = {
  "Engg": {
    stroke: "var(--status-info)",
    fill: "var(--status-info)",
    hatch: "url(#hatch-engg)",
    label: "Engg",
  },
  "TRD": {
    stroke: "var(--status-warning)",
    fill: "var(--status-warning)",
    hatch: "url(#hatch-trd)",
    label: "TRD",
  },
  "S&T": {
    stroke: "var(--status-success)",
    fill: "var(--status-success)",
    hatch: "url(#hatch-snt)",
    label: "S&T",
  },
};

export function getDeptColor(dept: string): string {
  return DEPT_COLORS[dept]?.stroke ?? "var(--text-secondary)";
}
