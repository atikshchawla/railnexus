import type { ApprovalProposalRecord, BlockRecord } from "@/lib/types";
import type { TopologyResponse } from "@/lib/api";

export interface RiskMetrics {
  statusLabel: string;
  category: "blocked" | "review" | "clear";
  confidence: number;
  isBlocked: boolean;
  needsAttention: boolean;
  reason: string;
}

export function getShortProposalId(id: string): string {
  if (!id) return "P-0000";
  // Clean prefixes e.g. "PROP-" or "P-" and non-alphanumeric chars
  const cleaned = id.replace(/^(PROP-|P-)/i, "").replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length <= 4) return `P-${cleaned.toUpperCase().padStart(4, "0")}`;
  // Use first 4 alphanumeric characters for predictable deterministic scan code
  return `P-${cleaned.slice(0, 4).toUpperCase()}`;
}

export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "--";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function getSectionTopologyBounds(sectionId: string, topology: TopologyResponse[] | undefined) {
  const sectionTopos = (topology || []).filter((t) => t.section_id === sectionId);
  const secMinKm = sectionTopos.length > 0 ? Math.min(...sectionTopos.map((t) => Math.min(t.start_km, t.end_km))) : 0.0;
  const secMaxKm = sectionTopos.length > 0 ? Math.max(...sectionTopos.map((t) => Math.max(t.start_km, t.end_km))) : 10.0;
  return { secMinKm, secMaxKm };
}

export function computeProposalKmBounds(
  proposal: ApprovalProposalRecord,
  blocks: BlockRecord[],
  topology: TopologyResponse[] | undefined,
) {
  const constituentBlocks = blocks.filter((b) =>
    (proposal.maintenance_request_ids || []).includes(b.id),
  );
  const { secMinKm, secMaxKm } = getSectionTopologyBounds(proposal.section_id, topology);
  const validConstituents = constituentBlocks.filter(
    (b) => b.location.kmStart >= secMinKm && b.location.kmEnd <= secMaxKm,
  );

  let startKm = secMinKm;
  let endKm = secMaxKm;

  if (validConstituents.length > 0) {
    startKm = Math.min(...validConstituents.map((b) => b.location.kmStart));
    endKm = Math.max(...validConstituents.map((b) => b.location.kmEnd));
  } else {
    startKm = secMinKm;
    endKm = Math.min(secMaxKm, secMinKm + Math.max(2.0, (secMaxKm - secMinKm) * 0.25));
  }

  if (endKm <= startKm) {
    endKm = Math.min(secMaxKm, startKm + 1.0);
  }

  const trackLine = constituentBlocks[0]?.location.line || "UP";
  const leadDept = proposal.lead_department || proposal.departments?.[0] || constituentBlocks[0]?.department || "ENGG";

  return { startKm, endKm, constituentBlocks, trackLine, leadDept };
}

export function getProposalRiskMetrics(
  proposal: ApprovalProposalRecord,
  constituentBlocks: BlockRecord[],
): RiskMetrics {
  const isBlocked = Boolean(proposal.has_blocking_conflicts || (proposal.blocking_conflict_count ?? 0) > 0);

  // Surface lowest constituent confidence
  const confList: number[] = [];
  constituentBlocks.forEach((b) => {
    if (b.aiSuggestion && typeof b.aiSuggestion.confidence === "number") {
      confList.push(b.aiSuggestion.confidence);
    } else if (b.mlPrediction && typeof b.mlPrediction.overrunProbability === "number") {
      confList.push(Math.round(Math.max(0, Math.min(1, 1 - b.mlPrediction.overrunProbability)) * 100));
    }
  });

  const fallbackConf = Math.round((proposal.confidence_score ?? 0.88) * 100);
  const lowestConf = confList.length > 0 ? Math.min(...confList) : fallbackConf;
  const hasCriticalConstituent = constituentBlocks.some((b) => b.urgency?.tier === "critical");
  const hasHighOverrun = constituentBlocks.some(
    (b) => b.mlPrediction && (b.mlPrediction.overrunProbability ?? 0) > 0.35,
  );

  if (isBlocked) {
    return {
      statusLabel: "BLOCKED · CONFLICT",
      category: "blocked",
      confidence: lowestConf,
      isBlocked: true,
      needsAttention: true,
      reason: `${proposal.blocking_conflict_count || 1} unresolved blocking conflict`,
    };
  }

  if (lowestConf < 70 || hasCriticalConstituent || hasHighOverrun) {
    return {
      statusLabel: `REVIEW · ${lowestConf}%`,
      category: "review",
      confidence: lowestConf,
      isBlocked: false,
      needsAttention: true,
      reason: hasCriticalConstituent
        ? "Critical urgency constituent in group"
        : hasHighOverrun
        ? "High overrun risk detected (>35%)"
        : `Lowest constituent confidence is ${lowestConf}%`,
    };
  }

  return {
    statusLabel: `CLEAR · ${lowestConf}%`,
    category: "clear",
    confidence: lowestConf,
    isBlocked: false,
    needsAttention: false,
    reason: "Zero conflicts · High model confidence",
  };
}

export function getConstituentWorkSummary(
  constituentBlocks: BlockRecord[],
  proposal: ApprovalProposalRecord,
): string {
  if (constituentBlocks.length === 0) {
    return proposal.departments?.join(", ") || "General Maintenance";
  }

  const rawWorkTypes = constituentBlocks.map((b) => {
    const desc = b.description || "";
    const prefix = desc.split(" on ")[0].trim();
    return prefix.length > 0 ? prefix.toUpperCase().replace(/\s+/g, "_") : b.category;
  });

  const unique = Array.from(new Set(rawWorkTypes));
  return unique.slice(0, 3).join(" + ") + (unique.length > 3 ? ` +${unique.length - 3} more` : "");
}
