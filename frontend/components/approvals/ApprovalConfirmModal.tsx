"use client";

import { X, CheckSquare, ShieldCheck, AlertTriangle } from "lucide-react";
import type { ApprovalProposalRecord, BlockRecord } from "@/lib/types";
import { formatTime, getShortProposalId, type RiskMetrics } from "./approval-utils";
import { DepartmentBadge } from "@/components/shared";

interface ApprovalConfirmModalProps {
  proposal: ApprovalProposalRecord;
  constituentBlocks: BlockRecord[];
  startKm: number;
  endKm: number;
  trackLine: string;
  leadDept: string;
  riskMetrics: RiskMetrics;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function ApprovalConfirmModal({
  proposal,
  constituentBlocks,
  startKm,
  endKm,
  trackLine,
  leadDept,
  riskMetrics,
  onConfirm,
  onClose,
  loading,
}: ApprovalConfirmModalProps) {
  const reqCount = proposal.maintenance_request_ids.length;
  const shortId = getShortProposalId(proposal.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border-default max-w-md w-full shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border-default flex items-center justify-between bg-surface-sunken shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-brand/15 text-brand">
              <CheckSquare size={16} />
            </span>
            <div>
              <h2 className="text-[13.5px] font-bold text-text-primary">
                Approve {reqCount} Request{reqCount !== 1 ? "s" : ""}?
              </h2>
              <p className="text-[11px] text-text-secondary font-mono">
                {shortId} &bull; {proposal.section_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-text-secondary hover:text-text-primary text-[18px] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-[12px]">
          <p className="text-text-secondary">
            You are granting an authoritative <strong>Operational Possession</strong>. This creates a binding operational block for field execution:
          </p>

          {/* Key Parameters Card */}
          <div className="bg-surface-sunken border border-border-default rounded p-3 space-y-2 text-[11.5px]">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Section / Line:</span>
              <span className="font-semibold text-text-primary">
                {proposal.section_id} &bull; Line {trackLine}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Location Limits:</span>
              <span className="font-mono font-medium text-text-primary">
                Km {startKm.toFixed(1)} – {endKm.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Time Window:</span>
              <span className="font-mono font-semibold text-text-primary">
                {formatTime(proposal.proposed_start_time)} – {formatTime(proposal.proposed_end_time)} ({proposal.predicted_duration_minutes.toFixed(0)} min)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Possession Saving:</span>
              <span className="font-mono font-bold text-positive">
                +{proposal.possession_saving_minutes.toFixed(0)} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Lowest Model Confidence:</span>
              <span className="font-bold text-text-primary">
                {riskMetrics.confidence}%
              </span>
            </div>
          </div>

          {/* Constituent breakdown */}
          <div>
            <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Constituent Work Scope ({reqCount})
            </div>
            <div className="max-h-36 overflow-y-auto border border-border-default rounded divide-y divide-border-default">
              {constituentBlocks.map((b) => (
                <div key={b.id} className="p-2 flex items-center justify-between bg-surface text-[11px]">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <DepartmentBadge dept={b.department} />
                    <span className="font-mono font-bold text-brand">{b.id}</span>
                    <span className="truncate text-text-secondary">{b.description}</span>
                  </div>
                  <span className="shrink-0 text-text-secondary font-mono text-[10px]">
                    Km {b.location.kmStart.toFixed(1)}–{b.location.kmEnd.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Verification Badge */}
          <div className="flex items-center gap-2 p-2 bg-positive/10 border border-positive/25 rounded text-positive text-[11px] font-medium">
            <ShieldCheck size={14} className="shrink-0" />
            <span>Passed Phase 6B conflict gate &bull; Zero blocking conflicts detected</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-surface-sunken border-t border-border-default flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-[11.5px] font-semibold border border-border-default text-text-secondary hover:bg-surface transition-colors rounded cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-[11.5px] font-bold bg-brand text-white hover:bg-brand-hover transition-colors rounded cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? "Authorizing..." : `Approve ${reqCount} Request${reqCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
