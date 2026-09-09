import type { UrgencyTier, BlockRecord, AnalyticsMetric } from "./types";

/**
 * R1 — Urgency tier derivation
 */
export function getUrgencyTier(timeToBreachHours: number | null): UrgencyTier {
  if (timeToBreachHours === null) return "routine";
  if (timeToBreachHours < 24) return "critical";
  if (timeToBreachHours <= 72) return "warning"; // 24-72
  if (timeToBreachHours <= 168) return "caution"; // 72-168
  return "routine";
}

/**
 * R2 — Batch/one-click action eligibility
 * Any row with an unresolved conflict is structurally blocked from batch actions.
 */
export function isBatchEligible(record: BlockRecord): boolean {
  if (!record.conflict) return true;
  return record.conflict.status === "Resolved";
}

/**
 * R3 — Confidence display template
 */
export function formatConfidence(confidence: number, basis: string, topFactor: string): string {
  return `${confidence}% confident this ${basis} — top factor: ${topFactor}`;
}

/**
 * R6 — Analytics improvement logic
 * isImprovement = goodDirection === "down" ? currentValue < baselineValue : currentValue > baselineValue
 */
export function isImprovement(metric: AnalyticsMetric): boolean {
  if (metric.goodDirection === "down") {
    return metric.currentValue < metric.baselineValue;
  }
  return metric.currentValue > metric.baselineValue;
}

/**
 * Helper for relative time formatting
 */
export function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffHours = (now.getTime() - d.getTime()) / 3600000;
  if (diffHours < 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}
