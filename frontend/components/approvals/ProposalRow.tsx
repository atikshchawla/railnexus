"use client";

import {
  Square,
  CheckSquare,
  AlertTriangle,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import type { ApprovalProposalRecord, BlockRecord } from "@/lib/types";
import type { TopologyResponse } from "@/lib/api";
import {
  formatTime,
  getShortProposalId,
  computeProposalKmBounds,
  getProposalRiskMetrics,
} from "./approval-utils";

interface ProposalRowProps {
  proposal: ApprovalProposalRecord;
  blocks: BlockRecord[];
  topology: TopologyResponse[] | undefined;
  isSelected: boolean;
  onReview: () => void;
}

export function ProposalRow({
  proposal,
  blocks,
  topology,
  isSelected,
  onReview,
}: ProposalRowProps) {
  const { constituentBlocks } = computeProposalKmBounds(proposal, blocks, topology);
  const riskMetrics = getProposalRiskMetrics(proposal, constituentBlocks);
  const shortId = getShortProposalId(proposal.id);
  const reqCount = proposal.maintenance_request_ids.length;

  let statusBadgeClasses = "text-positive";
  let statusIcon = <ShieldCheck size={14} className="shrink-0" />;

  if (riskMetrics.category === "blocked") {
    statusBadgeClasses = "text-critical";
    statusIcon = <AlertTriangle size={14} className="shrink-0" />;
  } else if (riskMetrics.category === "review") {
    statusBadgeClasses = "text-amber-800";
    statusIcon = <AlertTriangle size={14} className="shrink-0" />;
  }

  return (
    <div className="bg-surface border border-border-default rounded hover:border-brand/40 hover:shadow-sm transition-all flex items-center p-3 gap-6 text-[12px]">
      
      {/* 1. Selection & ID */}
      <div className="flex items-center gap-3 w-[120px] shrink-0">
        <button
          disabled={riskMetrics.isBlocked}
          className={`p-0.5 rounded shrink-0 ${riskMetrics.isBlocked ? "opacity-30 cursor-not-allowed" : "text-text-secondary hover:text-brand cursor-pointer"}`}
          title={riskMetrics.isBlocked ? "Cannot batch-select" : "Select"}
        >
          {isSelected ? <CheckSquare size={16} className="text-brand" /> : <Square size={16} />}
        </button>
        <span className="font-mono font-black text-[13px] text-text-primary tracking-tight">
          {shortId}
        </span>
      </div>

      {/* 2. Section */}
      <div className="w-[80px] shrink-0">
        <span className="text-[11px] bg-brand/10 text-brand px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          {proposal.section_id}
        </span>
      </div>

      {/* 3. Time Window */}
      <div className="w-[120px] shrink-0 font-mono font-medium text-[12px] text-text-primary">
        {formatTime(proposal.proposed_start_time)} → {formatTime(proposal.proposed_end_time)}
      </div>

      {/* 4. Request Count */}
      <div className="w-[120px] shrink-0 text-text-secondary">
        <strong className="text-text-primary font-bold">{reqCount}</strong> request{reqCount !== 1 ? "s" : ""}
      </div>

      {/* 5. Possession Saving */}
      <div className="w-[100px] shrink-0 font-mono font-bold text-positive bg-positive/10 px-2 py-0.5 rounded text-center">
        +{proposal.possession_saving_minutes.toFixed(0)} min
      </div>

      {/* 6. Risk Status */}
      <div className={`flex items-center gap-1.5 flex-1 min-w-0 font-bold uppercase tracking-wide text-[11px] ${statusBadgeClasses}`} title={riskMetrics.reason}>
        {statusIcon}
        <span className="truncate">{riskMetrics.statusLabel} · {riskMetrics.confidence}%</span>
      </div>

      {/* 7. Primary Action */}
      <div className="shrink-0 ml-auto">
        <button
          onClick={onReview}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white font-bold rounded shadow-xs hover:bg-brand-hover transition-colors cursor-pointer text-[11px] uppercase tracking-wide"
        >
          Review <ArrowRight size={13} />
        </button>
      </div>

    </div>
  );
}
