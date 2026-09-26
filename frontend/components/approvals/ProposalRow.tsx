"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  SlidersHorizontal,
  XCircle,
  CheckSquare,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Square,
  Sparkles,
} from "lucide-react";
import type { ApprovalProposalRecord, BlockRecord } from "@/lib/types";
import type { TopologyResponse } from "@/lib/api";
import {
  formatTime,
  formatDate,
  getShortProposalId,
  computeProposalKmBounds,
  getProposalRiskMetrics,
  getConstituentWorkSummary,
  type RiskMetrics,
} from "./approval-utils";
import { DepartmentBadge, ConflictIndicator } from "@/components/shared";

interface ProposalRowProps {
  proposal: ApprovalProposalRecord;
  blocks: BlockRecord[];
  topology: TopologyResponse[] | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenAdjust: (proposal: ApprovalProposalRecord) => void;
  onOpenReject: (proposal: ApprovalProposalRecord) => void;
  onRequestApprove: (proposal: ApprovalProposalRecord) => void;
  actionLoading: boolean;
}

export function ProposalRow({
  proposal,
  blocks,
  topology,
  isExpanded,
  onToggleExpand,
  isSelected,
  onToggleSelect,
  onOpenAdjust,
  onOpenReject,
  onRequestApprove,
  actionLoading,
}: ProposalRowProps) {
  const [copied, setCopied] = useState(false);

  const { startKm, endKm, constituentBlocks, trackLine, leadDept } = computeProposalKmBounds(
    proposal,
    blocks,
    topology,
  );

  const riskMetrics = getProposalRiskMetrics(proposal, constituentBlocks);
  const workSummary = getConstituentWorkSummary(constituentBlocks, proposal);
  const shortId = getShortProposalId(proposal.id);
  const reqCount = proposal.maintenance_request_ids.length;

  const handleCopyUuid = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(proposal.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Status Badge Styling based on semantic state
  let statusBadgeClasses = "bg-positive/10 text-positive border-positive/30";
  let statusIcon = <ShieldCheck size={13} className="shrink-0" />;

  if (riskMetrics.category === "blocked") {
    statusBadgeClasses = "bg-critical/10 text-critical border-critical/30";
    statusIcon = <AlertTriangle size={13} className="shrink-0" />;
  } else if (riskMetrics.category === "review") {
    statusBadgeClasses = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    statusIcon = <AlertTriangle size={13} className="shrink-0" />;
  }

  return (
    <div
      className={`border-b border-border-default transition-colors ${
        isExpanded ? "bg-surface-sunken/40" : "bg-surface hover:bg-surface-sunken/20"
      }`}
    >
      {/* ─── TWO-TIER ROW WRAPPER ────────────────────────────────────────── */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {/* ── LINE 1: SCAN / IDENTIFICATION LINE ── */}
        <div className="flex items-center justify-between gap-3 text-[12px] flex-wrap sm:flex-nowrap">
          {/* Left Scan Cluster */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* 1. Expand Chevron — SINGLE expansion affordance */}
            <button
              onClick={onToggleExpand}
              className="p-1 -ml-1 text-text-secondary hover:text-brand transition-colors cursor-pointer rounded shrink-0"
              title={isExpanded ? "Collapse proposal details" : "Expand constituent details"}
              aria-label="Expand proposal details"
            >
              {isExpanded ? (
                <ChevronDown size={17} className="text-brand" />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>

            {/* 2. Multi-select Checkbox (disabled if blocked by conflict) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!riskMetrics.isBlocked) onToggleSelect();
              }}
              disabled={riskMetrics.isBlocked}
              className={`p-0.5 rounded shrink-0 cursor-pointer ${
                riskMetrics.isBlocked ? "opacity-30 cursor-not-allowed" : "text-text-secondary hover:text-brand"
              }`}
              title={
                riskMetrics.isBlocked
                  ? "Cannot batch-select: Proposal has unresolved blocking conflicts"
                  : isSelected
                  ? "Deselect proposal"
                  : "Select proposal for batch approval"
              }
            >
              {isSelected ? (
                <CheckSquare size={16} className="text-brand" />
              ) : (
                <Square size={16} />
              )}
            </button>

            {/* 3. Short Human-Readable ID (e.g. P-0421) */}
            <div className="flex items-center gap-1 shrink-0">
              <span
                onClick={onToggleExpand}
                className="font-mono text-[12.5px] font-bold text-brand hover:underline cursor-pointer"
                title={`Full Proposal UUID: ${proposal.id}`}
              >
                {shortId}
              </span>
              <button
                onClick={handleCopyUuid}
                className="text-text-secondary hover:text-text-primary p-0.5"
                title="Copy complete Proposal UUID"
              >
                {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              </button>
            </div>

            {/* 4. Department Tags (e.g. ENGG · TRD) */}
            <div className="flex items-center gap-1 shrink-0">
              {proposal.departments.map((dept) => (
                <DepartmentBadge key={dept} dept={dept as any} />
              ))}
            </div>

            {/* 5. Section Identifier */}
            <span className="text-[11px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
              {proposal.section_id}
            </span>

            {/* 6. Schedule Window */}
            <div className="flex items-center gap-1.5 text-text-primary font-medium shrink-0 whitespace-nowrap">
              <span>
                {formatTime(proposal.proposed_start_time)} – {formatTime(proposal.proposed_end_time)}
              </span>
              <span className="text-[11px] text-text-secondary font-normal font-mono">
                ({proposal.predicted_duration_minutes.toFixed(0)}m)
              </span>
            </div>
          </div>

          {/* Right Status Cluster: Combined Risk / Confidence Indicator */}
          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold tracking-wide border uppercase font-mono ${statusBadgeClasses}`}
              title={riskMetrics.reason}
            >
              {statusIcon}
              <span>{riskMetrics.statusLabel}</span>
            </span>
          </div>
        </div>

        {/* ── LINE 2: DECISION LINE ── */}
        <div className="flex items-center justify-between gap-3 text-[12px] pt-1 border-t border-border-default/40 flex-wrap sm:flex-nowrap">
          {/* Left Side: Constituent Summary */}
          <div className="flex items-center gap-2 text-text-secondary min-w-0 truncate">
            <span className="font-semibold text-text-primary shrink-0">
              {reqCount} request{reqCount !== 1 ? "s" : ""} grouped
            </span>
            <span className="text-text-secondary/60">&bull;</span>
            <span className="truncate text-[11.5px] font-mono text-text-secondary" title={workSummary}>
              {workSummary}
            </span>
          </div>

          {/* Middle & Right: Key Metric + Fixed-Width Actions */}
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            {/* Middle: Decision Metric (Possession Saving & Km Range) */}
            <div className="flex items-center gap-2 text-[11.5px] whitespace-nowrap">
              <span className="text-text-secondary font-mono">
                Km {startKm.toFixed(1)}–{endKm.toFixed(1)} ({trackLine})
              </span>
              <span className="font-mono font-bold text-positive bg-positive/10 px-1.5 py-0.5 rounded text-[11px]">
                +{proposal.possession_saving_minutes.toFixed(0)} min saving
              </span>
            </div>

            {/* Right: Fixed-Width Human Actions (NEVER CLIPPED) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* [ ADJUST ] */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAdjust(proposal);
                }}
                disabled={actionLoading}
                title="Override schedule window, limits, or departments with mandatory human justification"
                className="inline-flex items-center justify-center min-w-[70px] px-2.5 py-1 text-[11px] font-semibold border border-amber-500/40 text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer rounded-sm shrink-0 whitespace-nowrap"
              >
                <SlidersHorizontal size={11} className="mr-1" /> Adjust
              </button>

              {/* [ REJECT ] */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReject(proposal);
                }}
                disabled={actionLoading}
                title="Decline AI proposal with audited reason"
                className="inline-flex items-center justify-center min-w-[70px] px-2.5 py-1 text-[11px] font-semibold border border-critical/30 text-critical hover:bg-critical/10 transition-colors cursor-pointer rounded-sm shrink-0 whitespace-nowrap"
              >
                <XCircle size={11} className="mr-1" /> Reject
              </button>

              {/* [ APPROVE (N) ] */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!riskMetrics.isBlocked) onRequestApprove(proposal);
                }}
                disabled={actionLoading || riskMetrics.isBlocked}
                title={
                  riskMetrics.isBlocked
                    ? "Approval blocked by unresolved conflicts. Resolve first in /conflicts"
                    : `Promote proposal to authoritative OperationalBlock (${reqCount} requests)`
                }
                className={`inline-flex items-center justify-center min-w-[95px] px-3 py-1 text-[11px] font-bold rounded-sm transition-colors shrink-0 whitespace-nowrap ${
                  riskMetrics.isBlocked
                    ? "bg-surface-sunken text-text-secondary border border-border-default opacity-50 cursor-not-allowed"
                    : "bg-brand text-white hover:bg-brand-hover cursor-pointer"
                }`}
              >
                <CheckSquare size={11} className="mr-1.5" /> Approve ({reqCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── EXPANDED PROPOSAL CONTENT (CHEVRON OPENED) ─────────────────── */}
      {isExpanded && (
        <div className="bg-surface-sunken/60 border-t border-border-default px-6 py-4 space-y-3 animate-in fade-in duration-150 text-[12px]">
          {/* Metadata Bar */}
          <div className="flex items-center justify-between text-[11px] text-text-secondary pb-2 border-b border-border-default/60 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span>
                Proposal UUID:{" "}
                <code className="font-mono text-text-primary bg-surface px-1 py-0.5 rounded border border-border-default">
                  {proposal.id}
                </code>
              </span>
              <span>
                Run ID:{" "}
                <code className="font-mono text-text-primary bg-surface px-1 py-0.5 rounded border border-border-default">
                  {proposal.run_id}
                </code>
              </span>
            </div>

            {riskMetrics.isBlocked ? (
              <div className="flex items-center gap-1.5 text-critical font-medium">
                <AlertTriangle size={13} />
                <span>Blocked: Resolve {proposal.blocking_conflict_count} conflict(s) in</span>
                <Link
                  href="/conflicts"
                  className="underline hover:text-critical/80 inline-flex items-center gap-0.5"
                >
                  /conflicts <ExternalLink size={10} />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-positive font-medium">
                <ShieldCheck size={13} />
                <span>Conflict-free possession window verified</span>
              </div>
            )}
          </div>

          {/* Constituent Mini-Rows/Cards */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center justify-between">
              <span>Constituent Maintenance Requests ({reqCount})</span>
              <span className="font-normal lowercase">Each request evaluated individually</span>
            </div>

            <div className="space-y-1.5">
              {constituentBlocks.map((item, idx) => {
                const conf = item.aiSuggestion?.confidence ?? 85;
                const isItemConflicted = Boolean(item.conflict && item.conflict.status === "Unresolved");
                let itemStatusLabel = `CLEAR · ${conf}%`;
                let itemStatusClass = "bg-positive/10 text-positive border-positive/25";

                if (isItemConflicted) {
                  itemStatusLabel = "BLOCKED · CONFLICT";
                  itemStatusClass = "bg-critical/10 text-critical border-critical/25";
                } else if (conf < 70 || item.urgency.tier === "critical") {
                  itemStatusLabel = `REVIEW · ${conf}%`;
                  itemStatusClass = "bg-amber-500/10 text-amber-600 border-amber-500/25";
                }

                return (
                  <div
                    key={item.id}
                    className="p-2.5 bg-surface border border-border-default rounded flex items-center justify-between gap-4 text-[11.5px]"
                  >
                    {/* Left: Request Identity & Dept */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-text-secondary">#{idx + 1}</span>
                      <DepartmentBadge dept={item.department} />
                      <span className="font-mono font-bold text-brand">{item.id}</span>
                      <span className="font-medium text-text-primary truncate">
                        {item.description}
                      </span>
                    </div>

                    {/* Middle: Location & Time */}
                    <div className="flex items-center gap-3 shrink-0 text-text-secondary font-mono text-[11px]">
                      <span>
                        Km {item.location.kmStart.toFixed(1)}–{item.location.kmEnd.toFixed(1)} ({item.location.line})
                      </span>
                      <span>
                        {formatTime(item.scheduledWindow.start)} – {formatTime(item.scheduledWindow.end)}
                      </span>
                    </div>

                    {/* Right: Individual Risk/Confidence Badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      {isItemConflicted && item.conflict && (
                        <ConflictIndicator conflictId={item.conflict.conflictId} />
                      )}
                      <span
                        className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded border uppercase ${itemStatusClass}`}
                      >
                        {itemStatusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}

              {constituentBlocks.length === 0 && (
                <div className="p-3 bg-surface border border-border-default rounded text-text-secondary italic text-[11.5px]">
                  Constituent IDs: {proposal.maintenance_request_ids.join(", ") || "None specified"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
