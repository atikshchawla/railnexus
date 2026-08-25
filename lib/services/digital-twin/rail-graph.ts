import { nearestPointOnPolyline, pointAtDistance, cumulativeLengths } from "./geometry";
import type { RailwayNetwork, Vec2 } from "./types";

/**
 * Network graph built from pure geometry: two tracks are connected wherever
 * they intersect or touch (within tolerance). Nothing is hardcoded to the
 * demo map — any future user-uploaded network works the same way.
 */

export interface Junction {
  aTrack: string;
  aPosM: number;
  bTrack: string;
  bPosM: number;
  x: number;
  y: number;
}

export interface RailGraph {
  junctions: Junction[];
  adjacency: Map<string, { to: string; junction: Junction }[]>;
}

const TOUCH_TOLERANCE = 15;
const JUNCTION_DEDUP = 30;

function segIntersect(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2
): { point: Vec2; t: number; u: number } | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { point: { x: p1.x + d1x * t, y: p1.y + d1y * t }, t, u };
}

function closestPointsSegSeg(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): { d: number; a: Vec2; b: Vec2 } {
  const candidates: { d: number; a: Vec2; b: Vec2 }[] = [];
  for (const [p, q, r] of [
    [p3, p4, p1],
    [p3, p4, p2],
    [p1, p2, p3],
    [p1, p2, p4],
  ] as const) {
    const abx = q.x - p.x;
    const aby = q.y - p.y;
    const lenSq = abx * abx + aby * aby || 1;
    const t = Math.max(0, Math.min(1, ((r.x - p.x) * abx + (r.y - p.y) * aby) / lenSq));
    const proj = { x: p.x + abx * t, y: p.y + aby * t };
    candidates.push({ d: Math.hypot(r.x - proj.x, r.y - proj.y), a: r, b: proj });
  }
  return candidates.reduce((m, c) => (c.d < m.d ? c : m));
}

function posOnTrack(points: Vec2[], segIndex: number, t: number): number {
  const cum = cumulativeLengths(points);
  const segLen = Math.hypot(
    points[segIndex + 1].x - points[segIndex].x,
    points[segIndex + 1].y - points[segIndex].y
  );
  return cum[segIndex] + segLen * t;
}

export function buildRailGraph(network: RailwayNetwork): RailGraph {
  const tracks = Object.values(network.tracks);
  const junctions: Junction[] = [];

  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const A = tracks[i];
      const B = tracks[j];
      const pairHits: Junction[] = [];

      for (let si = 0; si < A.points.length - 1; si++) {
        for (let sj = 0; sj < B.points.length - 1; sj++) {
          const a1 = A.points[si];
          const a2 = A.points[si + 1];
          const b1 = B.points[sj];
          const b2 = B.points[sj + 1];

          const hit = segIntersect(a1, a2, b1, b2);
          if (hit) {
            pairHits.push({
              aTrack: A.id,
              aPosM: posOnTrack(A.points, si, hit.t),
              bTrack: B.id,
              bPosM: posOnTrack(B.points, sj, hit.u),
              x: hit.point.x,
              y: hit.point.y,
            });
            continue;
          }
          const close = closestPointsSegSeg(a1, a2, b1, b2);
          if (close.d <= TOUCH_TOLERANCE) {
            const cumA = cumulativeLengths(A.points);
            const cumB = cumulativeLengths(B.points);
            pairHits.push({
              aTrack: A.id,
              aPosM: nearestCumPos(A.points, cumA, close.a),
              bTrack: B.id,
              bPosM: nearestCumPos(B.points, cumB, close.b),
              x: (close.a.x + close.b.x) / 2,
              y: (close.a.y + close.b.y) / 2,
            });
          }
        }
      }

      pairHits.sort((p, q) => p.aPosM - q.aPosM);
      let lastKept: Junction | null = null;
      for (const hit of pairHits) {
        if (lastKept && Math.abs(hit.aPosM - lastKept.aPosM) < JUNCTION_DEDUP) continue;
        junctions.push(hit);
        lastKept = hit;
      }
    }
  }

  const adjacency = new Map<string, { to: string; junction: Junction }[]>();
  for (const track of tracks) adjacency.set(track.id, []);
  for (const j of junctions) {
    adjacency.get(j.aTrack)?.push({ to: j.bTrack, junction: j });
    adjacency.get(j.bTrack)?.push({ to: j.aTrack, junction: j });
  }

  return { junctions, adjacency };
}

function nearestCumPos(points: Vec2[], cum: number[], target: Vec2): number {
  let bestDist = Infinity;
  let bestM = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const near = nearestPointOnPolyline([points[i], points[i + 1]], target);
    if (near && near.offsetPx < bestDist) {
      bestDist = near.offsetPx;
      bestM = cum[i] + near.trackDistM;
    }
  }
  return bestM;
}

/** BFS shortest path over junction edges. `avoid` skips disrupted tracks (start always allowed). */
export function findRoute(
  graph: RailGraph,
  fromTrack: string,
  toTrack: string,
  avoid: Set<string> = new Set()
): string[] | null {
  if (fromTrack === toTrack) return [fromTrack];
  const prev = new Map<string, string>();
  const queue = [fromTrack];
  const seen = new Set([fromTrack]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (seen.has(edge.to) || (avoid.has(edge.to) && edge.to !== toTrack)) continue;
      seen.add(edge.to);
      prev.set(edge.to, current);
      if (edge.to === toTrack) {
        const path = [toTrack];
        let node = toTrack;
        while (prev.has(node)) {
          node = prev.get(node)!;
          path.unshift(node);
        }
        return path;
      }
      queue.push(edge.to);
    }
  }
  return null;
}

export function junctionBetween(
  graph: RailGraph,
  fromTrack: string,
  toTrack: string
): Junction[] {
  return (graph.adjacency.get(fromTrack) ?? [])
    .filter((e) => e.to === toTrack)
    .map((e) => e.junction);
}

export interface StationAnchor {
  trackId: string;
  posM: number;
}

/** Project every station onto its nearest track (within tolerance). */
export function stationAnchors(network: RailwayNetwork): Map<string, StationAnchor> {
  const anchors = new Map<string, StationAnchor>();
  const tracks = Object.values(network.tracks);

  for (const station of Object.values(network.stations)) {
    let best: { trackId: string; posM: number; offset: number } | null = null;
    for (const track of tracks) {
      const near = nearestPointOnPolyline(track.points, station.position);
      if (near && near.offsetPx <= 80 && (!best || near.offsetPx < best.offset)) {
        best = { trackId: track.id, posM: near.trackDistM, offset: near.offsetPx };
      }
    }
    if (best) anchors.set(station.id, { trackId: best.trackId, posM: best.posM });
  }
  return anchors;
}

export function trackLength(points: Vec2[]): number {
  return cumulativeLengths(points).at(-1) ?? 0;
}

export { pointAtDistance };
