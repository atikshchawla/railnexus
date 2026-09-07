import { PATH_TABLE, fmtTime, type PathSlot } from "./mock-data";

export type ConflictResult = {
  status: "clear" | "conflict";
  hits: PathSlot[];
  message: string;
  suggestion: { start: number; end: number } | null;
};

/** Pure conflict check of a block window against mock train paths. */
export function checkConflicts(start: number, end: number): ConflictResult {
  const hits = PATH_TABLE.filter((p) => start < p.to && end > p.from);

  if (hits.length === 0) {
    return {
      status: "clear",
      hits: [],
      message: "GREEN — no conflicts. Corridor free for the requested window.",
      suggestion: null,
    };
  }

  const first = hits.reduce((a, b) => (a.from < b.from ? a : b));
  const suggestedEnd = Math.min(end, first.from - 15);
  const suggestion =
    suggestedEnd - start >= 60 ? { start, end: suggestedEnd } : { start: 810, end: 960 };

  return {
    status: "conflict",
    hits,
    message: `RED — window collides with ${first.service} (${fmtTime(first.from)}–${fmtTime(first.to)}).`,
    suggestion,
  };
}
