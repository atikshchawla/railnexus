import type { Track, Vec2 } from "./types";

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polylineLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

export function cumulativeLengths(points: Vec2[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + distance(points[i - 1], points[i]));
  return cum;
}

/** Position + heading angle (radians) at a given distance along a polyline. */
export function pointAtDistance(
  points: Vec2[],
  cum: number[],
  distM: number
): { position: Vec2; angle: number } {
  if (points.length === 0) return { position: { x: 0, y: 0 }, angle: 0 };
  const d = Math.max(0, Math.min(distM, cum[cum.length - 1]));

  let seg = 0;
  while (seg < cum.length - 2 && cum[seg + 1] < d) seg++;

  const start = points[seg];
  const end = points[seg + 1];
  const segLen = cum[seg + 1] - cum[seg] || 1;
  const t = (d - cum[seg]) / segLen;

  return {
    position: { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t },
    angle: Math.atan2(end.y - start.y, end.x - start.x),
  };
}

export interface NearestOnPolyline {
  trackDistM: number;
  worldPoint: Vec2;
  angle: number;
  /** Perpendicular distance from the query point to the polyline. */
  offsetPx: number;
}

/** Project a world point onto a polyline, returning distance-along and snap info. */
export function nearestPointOnPolyline(points: Vec2[], p: Vec2): NearestOnPolyline | null {
  if (points.length < 2) return null;
  let best: NearestOnPolyline | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby || 1;
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + abx * t, y: a.y + aby * t };
    const offset = Math.hypot(p.x - proj.x, p.y - proj.y);

    if (!best || offset < best.offsetPx) {
      best = {
        trackDistM: cumulativeLengthsUpTo(points, i) + Math.sqrt(lenSq) * t,
        worldPoint: proj,
        angle: Math.atan2(aby, abx),
        offsetPx: offset,
      };
    }
  }
  return best;
}

function cumulativeLengthsUpTo(points: Vec2[], segIndex: number): number {
  let total = 0;
  for (let i = 0; i < segIndex; i++) total += distance(points[i], points[i + 1]);
  return total;
}

/** Find the closest track to a world point within maxOffset. */
export function findNearestTrack(
  tracks: Record<string, Track>,
  p: Vec2,
  maxOffset: number
): { track: Track; nearest: NearestOnPolyline } | null {
  let best: { track: Track; nearest: NearestOnPolyline } | null = null;
  for (const track of Object.values(tracks)) {
    const nearest = nearestPointOnPolyline(track.points, p);
    if (nearest && nearest.offsetPx <= maxOffset && (!best || nearest.offsetPx < best.nearest.offsetPx)) {
      best = { track, nearest };
    }
  }
  return best;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
