"use client";

import { useState, useMemo, useCallback } from "react";
import { TopBar } from "@/components/layout";
import { useDashboardData } from "@/lib/dashboard-context";
import { AcronymLegend, DepartmentBadge } from "@/components/shared";
import {
  Filter,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Info,
  ArrowUpDown,
  CheckSquare,
  Square,
} from "lucide-react";
import type { ApprovalProposalRecord, ProposalApprovePayload } from "@/lib/types";
import { approveProposal, rejectProposal } from "@/lib/api";
import {
  computeProposalKmBounds,
  getProposalRiskMetrics,
  formatTime,
  formatDate,
  type RiskMetrics,
} from "@/components/approvals/approval-utils";
import { ProposalRow } from "@/components/approvals/ProposalRow";
import { ApprovalConfirmModal } from "@/components/approvals/ApprovalConfirmModal";
import { BatchApprovalConfirmModal } from "@/components/approvals/BatchApprovalConfirmModal";
import { AdjustModal } from "@/components/approvals/AdjustModal";
import { RejectModal } from "@/components/approvals/RejectModal";

type TabMode = "pending" | "approved" | "rejected";
type SortMode = "soonest" | "lowest_confidence" | "highest_saving" | "needs_attention";
type RiskFilterMode = "all" | "attention" | "clear" | "blocked";

export default function ApprovalsPage() {
  const { data, refresh } = useDashboardData();
  const { proposals, operationalBlocks, blocks, topology } = data;

  const [activeTab, setActiveTab] = useState<TabMode>("pending");
  const [deptFilter, setDeptFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("soonest");
  const [riskFilter, setRiskFilter] = useState<RiskFilterMode>("all");

  // Selection & Expansion state
  const [expandedProposalIds, setExpandedProposalIds] = useState<Set<string>>(new Set());
  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(new Set());

  // Action status message
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [confirmApproveProposal, setConfirmApproveProposal] = useState<ApprovalProposalRecord | null>(null);
  const [adjustTargetProposal, setAdjustTargetProposal] = useState<ApprovalProposalRecord | null>(null);
  const [rejectTargetProposal, setRejectTargetProposal] = useState<ApprovalProposalRecord | null>(null);
  const [isBatchApproveOpen, setIsBatchApproveOpen] = useState(false);
  const [batchProgressText, setBatchProgressText] = useState<string | undefined>(undefined);

  // ─── Filtered Data ──────────────────────────────────────────────────────────
  const pendingProposals = useMemo(
    () => proposals.filter((p) => p.status === "PROPOSED"),
    [proposals],
  );

  const approvedProposals = useMemo(
    () => proposals.filter((p) => p.status === "ACCEPTED" || p.status === "OVERRIDDEN"),
    [proposals],
  );

  const rejectedProposals = useMemo(
    () => proposals.filter((p) => p.status === "REJECTED"),
    [proposals],
  );

  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    proposals.forEach((p) => {
      if (p.section_id) set.add(p.section_id);
    });
    return Array.from(set).sort();
  }, [proposals]);

  // Precompute metrics and filter pending proposals
  const filteredAndSortedPending = useMemo(() => {
    // 1. Filter by Dept, Section, Risk
    const filtered = pendingProposals.filter((p) => {
      const matchDept =
        deptFilter === "All" ||
        p.departments?.some((d) => d.toUpperCase() === deptFilter.toUpperCase()) ||
        p.lead_department?.toUpperCase() === deptFilter.toUpperCase();
      const matchSec = sectionFilter === "All" || p.section_id === sectionFilter;

      if (!matchDept || !matchSec) return false;

      const constituentBlocks = blocks.filter((b) =>
        (p.maintenance_request_ids || []).includes(b.id),
      );
      const metrics = getProposalRiskMetrics(p, constituentBlocks);

      if (riskFilter === "attention") return metrics.needsAttention;
      if (riskFilter === "clear") return metrics.category === "clear";
      if (riskFilter === "blocked") return metrics.isBlocked;
      return true;
    });

    // 2. Sort by selected SortMode
    return filtered.sort((a, b) => {
      const aConstituents = blocks.filter((item) =>
        (a.maintenance_request_ids || []).includes(item.id),
      );
      const bConstituents = blocks.filter((item) =>
        (b.maintenance_request_ids || []).includes(item.id),
      );
      const aMetrics = getProposalRiskMetrics(a, aConstituents);
      const bMetrics = getProposalRiskMetrics(b, bConstituents);

      if (sortMode === "soonest") {
        const aTime = a.proposed_start_time ? new Date(a.proposed_start_time).getTime() : 0;
        const bTime = b.proposed_start_time ? new Date(b.proposed_start_time).getTime() : 0;
        return aTime - bTime;
      }
      if (sortMode === "lowest_confidence") {
        return aMetrics.confidence - bMetrics.confidence;
      }
      if (sortMode === "highest_saving") {
        return (b.possession_saving_minutes || 0) - (a.possession_saving_minutes || 0);
      }
      if (sortMode === "needs_attention") {
        if (aMetrics.needsAttention && !bMetrics.needsAttention) return -1;
        if (!aMetrics.needsAttention && bMetrics.needsAttention) return 1;
        return aMetrics.confidence - bMetrics.confidence;
      }
      return 0;
    });
  }, [pendingProposals, deptFilter, sectionFilter, riskFilter, sortMode, blocks]);

  // Counts for filter pills
  const riskCounts = useMemo(() => {
    let attentionCount = 0;
    let clearCount = 0;
    let blockedCount = 0;

    pendingProposals.forEach((p) => {
      const constituents = blocks.filter((b) =>
        (p.maintenance_request_ids || []).includes(b.id),
      );
      const metrics = getProposalRiskMetrics(p, constituents);
      if (metrics.needsAttention) attentionCount++;
      if (metrics.category === "clear") clearCount++;
      if (metrics.isBlocked) blockedCount++;
    });

    return { total: pendingProposals.length, attentionCount, clearCount, blockedCount };
  }, [pendingProposals, blocks]);

  // List of eligible proposals for multi-select
  const eligibleSelectedProposals = useMemo(() => {
    return filteredAndSortedPending.filter(
      (p) => selectedProposalIds.has(p.id) && !p.has_blocking_conflicts,
    );
  }, [filteredAndSortedPending, selectedProposalIds]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedProposalIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedProposalIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllEligible = () => {
    const unblockedIds = filteredAndSortedPending
      .filter((p) => !p.has_blocking_conflicts)
      .map((p) => p.id);

    const allSelected = unblockedIds.every((id) => selectedProposalIds.has(id));
    if (allSelected) {
      setSelectedProposalIds((prev) => {
        const next = new Set(prev);
        unblockedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedProposalIds((prev) => {
        const next = new Set(prev);
        unblockedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Execute Authoritative Approval
  const executeApprove = async (proposal: ApprovalProposalRecord) => {
    if (!proposal || !proposal.id) {
      throw new Error("A valid proposal record with explicit ID is required.");
    }
    if (proposal.status !== "PROPOSED") {
      throw new Error(`Proposal ${proposal.id} is in status ${proposal.status} and cannot be approved.`);
    }
    if (proposal.has_blocking_conflicts) {
      setActionMessage({
        type: "error",
        text: `Cannot approve Proposal ${proposal.id.slice(0, 8)}: Unresolved blocking conflicts detected. Safety invariant requires resolving conflicts first in /conflicts.`,
      });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);
    try {
      const { startKm, endKm, trackLine, leadDept } = computeProposalKmBounds(proposal, blocks, topology);

      const payload: ProposalApprovePayload = {
        block_id: `OP-${proposal.section_id}-${proposal.id.slice(0, 8).toUpperCase()}`,
        approved_by: "CTRL-01",
        lead_department: leadDept,
        start_km: startKm,
        end_km: endKm,
        track_line: trackLine,
      };

      const result = await approveProposal(proposal.id, payload);
      setActionMessage({
        type: "success",
        text: `Operational Possession granted: Block ${result.id} (${result.section_id}) authorized and ready for execution.`,
      });
      refresh();
      setConfirmApproveProposal(null);
      setSelectedProposalIds((prev) => {
        const next = new Set(prev);
        next.delete(proposal.id);
        return next;
      });
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Approval failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Batch Approval sequentially with individual backend validation
  const executeBatchApprove = async () => {
    if (eligibleSelectedProposals.length === 0) return;
    setActionLoading(true);
    setActionMessage(null);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < eligibleSelectedProposals.length; i++) {
      const p = eligibleSelectedProposals[i];
      setBatchProgressText(`Authorizing ${i + 1} of ${eligibleSelectedProposals.length}: ${p.section_id}...`);
      try {
        const { startKm, endKm, trackLine, leadDept } = computeProposalKmBounds(p, blocks, topology);
        const payload: ProposalApprovePayload = {
          block_id: `OP-${p.section_id}-${p.id.slice(0, 8).toUpperCase()}`,
          approved_by: "CTRL-01",
          lead_department: leadDept,
          start_km: startKm,
          end_km: endKm,
          track_line: trackLine,
        };
        await approveProposal(p.id, payload);
        successCount++;
      } catch (err) {
        console.error(`Batch approval error for ${p.id}:`, err);
        failedCount++;
      }
    }

    refresh();
    setSelectedProposalIds(new Set());
    setIsBatchApproveOpen(false);
    setBatchProgressText(undefined);
    setActionLoading(false);

    if (failedCount === 0) {
      setActionMessage({
        type: "success",
        text: `Batch authorization completed: Successfully promoted ${successCount} proposals to OperationalBlocks.`,
      });
    } else {
      setActionMessage({
        type: "error",
        text: `Batch authorization finished with issues: ${successCount} authorized, ${failedCount} failed backend validation.`,
      });
    }
  };

  // Submit Genuine Human Manual Override
  const executeAdjust = async (payload: ProposalApprovePayload) => {
    if (!adjustTargetProposal) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const result = await approveProposal(adjustTargetProposal.id, payload);
      setActionMessage({
        type: "success",
        text: `Controller Adjusted Possession Granted: Block ${result.id} authorized with audited manual override (${payload.override_code}).`,
      });
      refresh();
      setAdjustTargetProposal(null);
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Adjustment authorization failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Rejection
  const executeReject = async (reason: string) => {
    if (!rejectTargetProposal) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      await rejectProposal(rejectTargetProposal.id, {
        rejected_by: "CTRL-01",
        rejection_reason: reason,
        operator_role: "SECTION_CONTROLLER",
      });
      setActionMessage({
        type: "success",
        text: `Proposal ${rejectTargetProposal.id.slice(0, 8)} successfully rejected. Audit log updated.`,
      });
      refresh();
      setRejectTargetProposal(null);
      setSelectedProposalIds((prev) => {
        const next = new Set(prev);
        next.delete(rejectTargetProposal.id);
        return next;
      });
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Rejection failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <TopBar
        title="Authoritative block approvals"
        subtitle="Human-in-the-Loop Gateway: Triage, adjust, and authorize AI block proposals into legal OperationalBlocks"
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-canvas">
        {/* Human-in-the-Loop Operational Banner */}
        <div className="shrink-0 bg-surface-sunken border-b border-border-default px-5 py-2.5 flex items-center justify-between gap-4 text-[12px]">
          <div className="flex items-center gap-2 text-text-primary">
            <span className="p-1 rounded bg-brand/10 text-brand">
              <Sparkles size={14} />
            </span>
            <span>
              <strong>RailNexus Lifecycle:</strong> AI / CP-SAT Recommendation &rarr; <strong>Block Proposal</strong> &rarr;{" "}
              <span className="text-amber-600 font-semibold underline decoration-amber-500/50 underline-offset-2">
                Section Controller Decision
              </span>{" "}
              &rarr; <strong>Authoritative Operational Block</strong>.
            </span>
          </div>
          <div className="text-[11px] text-text-secondary flex items-center gap-2">
            <Info size={13} className="text-text-secondary" />
            <span>A BlockProposal is not legal possession until authorized.</span>
          </div>
        </div>

        {/* Action alert message */}
        {actionMessage && (
          <div
            className={`px-5 py-2.5 text-[12px] font-medium flex items-center justify-between border-b ${
              actionMessage.type === "success"
                ? "bg-success/10 border-success/20 text-success"
                : "bg-critical/10 border-critical/20 text-critical"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-text-secondary hover:text-text-primary cursor-pointer text-[14px]"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab & Metric Navigation Bar */}
        <div className="shrink-0 px-5 bg-surface border-b border-border-default flex items-center justify-between text-[12px]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-3 px-3 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "pending"
                  ? "border-brand text-brand"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>Awaiting Decision</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                  pendingProposals.length > 0 ? "bg-brand/15 text-brand" : "bg-surface-sunken text-text-secondary"
                }`}
              >
                {pendingProposals.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`py-3 px-3 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "approved"
                  ? "border-positive text-positive"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>Operational Possessions</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-positive/15 text-positive">
                {operationalBlocks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("rejected")}
              className={`py-3 px-3 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "rejected"
                  ? "border-critical text-critical"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>Rejected History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-critical/15 text-critical">
                {rejectedProposals.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11.5px] text-text-secondary">
              Combined Possession Saving:{" "}
              <strong className="text-positive font-mono font-medium">
                {pendingProposals.reduce((sum, p) => sum + (p.possession_saving_minutes || 0), 0).toFixed(0)} min
              </strong>
            </span>
            <button
              onClick={() => refresh()}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors cursor-pointer disabled:opacity-50 rounded-sm"
            >
              <RefreshCw size={11} className={actionLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* ─── TAB 1: AWAITING DECISION ───────────────────────────────────────── */}
        {activeTab === "pending" && (
          <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-3.5">
            <AcronymLegend />

            {/* Triage & Operational Filter Bar */}
            <div className="bg-surface border border-border-default p-3 flex items-center justify-between gap-4 flex-wrap text-[12px] shadow-xs">
              {/* Left: Triage Pills & Status Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-text-primary flex items-center gap-1 mr-1">
                  <Filter size={13} className="text-text-secondary" /> Triage:
                </span>

                {/* All */}
                <button
                  onClick={() => setRiskFilter("all")}
                  className={`px-2.5 py-1 rounded-sm text-[11.5px] font-semibold transition-colors cursor-pointer border ${
                    riskFilter === "all"
                      ? "bg-brand text-white border-brand"
                      : "bg-surface-sunken text-text-secondary border-border-default hover:text-text-primary"
                  }`}
                >
                  All ({riskCounts.total})
                </button>

                {/* Needs Attention */}
                <button
                  onClick={() => setRiskFilter("attention")}
                  className={`px-2.5 py-1 rounded-sm text-[11.5px] font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                    riskFilter === "attention"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  }`}
                >
                  <AlertTriangle size={12} />
                  <span>Needs Attention ({riskCounts.attentionCount})</span>
                </button>

                {/* Clear */}
                <button
                  onClick={() => setRiskFilter("clear")}
                  className={`px-2.5 py-1 rounded-sm text-[11.5px] font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                    riskFilter === "clear"
                      ? "bg-positive text-white border-positive"
                      : "bg-positive/10 text-positive border-positive/30 hover:bg-positive/20"
                  }`}
                >
                  <ShieldCheck size={12} />
                  <span>Clear ({riskCounts.clearCount})</span>
                </button>

                {/* Blocked */}
                <button
                  onClick={() => setRiskFilter("blocked")}
                  className={`px-2.5 py-1 rounded-sm text-[11.5px] font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                    riskFilter === "blocked"
                      ? "bg-critical text-white border-critical"
                      : "bg-critical/10 text-critical border-critical/30 hover:bg-critical/20"
                  }`}
                >
                  <XCircle size={12} />
                  <span>Blocked ({riskCounts.blockedCount})</span>
                </button>

                {/* Vertical Divider */}
                <div className="h-4 w-px bg-border-default mx-1 hidden sm:block" />

                {/* Department Dropdown */}
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-surface-sunken border border-border-default px-2 py-1 text-text-primary font-medium focus:ring-0 cursor-pointer rounded-sm text-[11.5px]"
                >
                  <option value="All">All Departments</option>
                  <option value="ENGG">Engineering (ENGG)</option>
                  <option value="TRD">Traction (TRD)</option>
                  <option value="S&T">Signalling (S&T)</option>
                </select>

                {/* Section Dropdown */}
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="bg-surface-sunken border border-border-default px-2 py-1 text-text-primary font-medium focus:ring-0 cursor-pointer rounded-sm text-[11.5px]"
                >
                  <option value="All">All Sections</option>
                  {uniqueSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Right: Sort Dropdown & Queue Metric */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center gap-1.5 text-text-secondary text-[11.5px]">
                  <ArrowUpDown size={13} />
                  <span className="font-semibold text-text-primary">Sort:</span>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="bg-surface-sunken border border-border-default px-2 py-1 text-text-primary font-medium focus:ring-0 cursor-pointer rounded-sm text-[11.5px]"
                  >
                    <option value="soonest">Soonest Window</option>
                    <option value="lowest_confidence">Lowest Confidence (Risk First)</option>
                    <option value="highest_saving">Highest Saving</option>
                    <option value="needs_attention">Needs Attention First</option>
                  </select>
                </div>

                <div className="text-[11.5px] text-text-secondary whitespace-nowrap pl-2 border-l border-border-default">
                  Showing <strong>{filteredAndSortedPending.length}</strong> of <strong>{pendingProposals.length}</strong>
                </div>
              </div>
            </div>

            {/* Batch Action Bar (Visible when items selected) */}
            {selectedProposalIds.size > 0 && (
              <div className="bg-brand/10 border border-brand/30 rounded p-2.5 flex items-center justify-between gap-4 text-[12px] animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-brand font-semibold">
                  <CheckSquare size={16} />
                  <span>
                    {eligibleSelectedProposals.length} proposal{eligibleSelectedProposals.length !== 1 ? "s" : ""} selected (
                    {eligibleSelectedProposals.reduce((sum, p) => sum + p.maintenance_request_ids.length, 0)} requests)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProposalIds(new Set())}
                    className="px-2.5 py-1 text-[11.5px] text-text-secondary hover:text-text-primary border border-border-default rounded bg-surface transition-colors cursor-pointer"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={() => setIsBatchApproveOpen(true)}
                    disabled={eligibleSelectedProposals.length === 0}
                    className="px-3.5 py-1 text-[11.5px] font-bold bg-brand text-white hover:bg-brand-hover rounded transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Approve Selected ({eligibleSelectedProposals.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Table Header: Column Labels and Select All */}
            <div className="bg-surface border border-border-default rounded overflow-hidden shadow-xs">
              <div className="bg-surface-sunken border-b border-border-default px-4 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleSelectAllEligible}
                    className="text-text-secondary hover:text-brand cursor-pointer p-0.5 rounded"
                    title="Toggle select all eligible proposals in current view"
                  >
                    {filteredAndSortedPending.length > 0 &&
                    filteredAndSortedPending
                      .filter((p) => !p.has_blocking_conflicts)
                      .every((p) => selectedProposalIds.has(p.id)) ? (
                      <CheckSquare size={15} className="text-brand" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                  <span>Proposal &bull; Department &bull; Section &bull; Schedule</span>
                </div>
                <div className="flex items-center gap-8">
                  <span>Risk / Confidence Gate</span>
                  <span className="hidden sm:inline">Human Decision Controls</span>
                </div>
              </div>

              {/* Main Proposal Rows (Two-Tier Hierarchy) */}
              <div className="divide-y divide-border-default">
                {filteredAndSortedPending.map((p) => (
                  <ProposalRow
                    key={p.id}
                    proposal={p}
                    blocks={blocks}
                    topology={topology}
                    isExpanded={expandedProposalIds.has(p.id)}
                    onToggleExpand={() => toggleExpand(p.id)}
                    isSelected={selectedProposalIds.has(p.id)}
                    onToggleSelect={() => toggleSelect(p.id)}
                    onOpenAdjust={(proposal) => setAdjustTargetProposal(proposal)}
                    onOpenReject={(proposal) => setRejectTargetProposal(proposal)}
                    onRequestApprove={(proposal) => setConfirmApproveProposal(proposal)}
                    actionLoading={actionLoading}
                  />
                ))}

                {filteredAndSortedPending.length === 0 && (
                  <div className="px-5 py-12 text-center text-text-secondary text-[12.5px]">
                    No block proposals awaiting controller decision with the selected filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: OPERATIONAL POSSESSIONS (APPROVED) ──────────────────────── */}
        {activeTab === "approved" && (
          <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                  <ShieldCheck size={17} className="text-positive" />
                  Authoritative Operational Possessions ({operationalBlocks.length})
                </h2>
                <p className="text-[11.5px] text-text-secondary">
                  Legal track blocks authorized by Section Controller &bull; Ready for field departmental possession
                </p>
              </div>
            </div>

            <div className="bg-surface border border-border-default overflow-x-auto shadow-sm rounded">
              <table className="w-full text-[12.5px] table-fixed min-w-[1100px]">
                <colgroup>
                  <col className="w-[190px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col className="w-[170px]" />
                  <col className="w-[140px]" />
                  <col className="w-[190px]" />
                  <col className="w-[150px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead>
                  <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px] border-b border-border-default">
                    <th className="px-4 py-2.5 font-semibold">Operational Block ID</th>
                    <th className="px-4 py-2.5 font-semibold">Section</th>
                    <th className="px-4 py-2.5 font-semibold">Lead Dept</th>
                    <th className="px-4 py-2.5 font-semibold">Allocated Window</th>
                    <th className="px-4 py-2.5 font-semibold">Km Limits</th>
                    <th className="px-4 py-2.5 font-semibold">Origin Proposal</th>
                    <th className="px-4 py-2.5 font-semibold">Authorization Mode</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {operationalBlocks.map((ob) => {
                    const isAdjusted = Boolean(ob.override_id);
                    return (
                      <tr key={ob.id} className="hover:bg-surface-sunken/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-[12px] font-bold text-brand">{ob.id}</td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          <span className="text-[11px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-bold">
                            {ob.section_id}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <DepartmentBadge dept={ob.lead_department as any} />
                        </td>
                        <td className="px-4 py-3 text-[12px] font-medium text-text-primary whitespace-nowrap">
                          {formatTime(ob.scheduled_start || ob.allocated_start_time || "")} –{" "}
                          {formatTime(ob.scheduled_end || ob.allocated_end_time || "")}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-text-secondary font-mono">
                          Km {ob.start_km ?? 0}–{ob.end_km ?? 0} ({ob.track_line || "UP"})
                        </td>
                        <td className="px-4 py-3 text-[11px] text-text-secondary font-mono">
                          {ob.origin_proposal_id ? `${ob.origin_proposal_id.slice(0, 8)}...` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isAdjusted ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                              <SlidersHorizontal size={10} /> HUMAN ADJUSTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-surface-sunken text-text-secondary border border-border-default">
                              <Sparkles size={10} /> AI VERIFIED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-positive/10 text-positive text-[11px] font-bold uppercase">
                            <Radio size={10} className="animate-pulse" /> {ob.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {operationalBlocks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-text-secondary text-[12.5px]">
                        No operational blocks authorized yet. Approve candidate proposals in the &ldquo;Awaiting Decision&rdquo; tab to grant possession.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 3: REJECTED HISTORY ────────────────────────────────────────── */}
        {activeTab === "rejected" && (
          <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                  <XCircle size={17} className="text-critical" />
                  Audited Rejection History ({rejectedProposals.length})
                </h2>
                <p className="text-[11.5px] text-text-secondary">
                  Proposals declined by Section Controller &bull; Staged with permanent audit rationale
                </p>
              </div>
            </div>

            <div className="bg-surface border border-border-default overflow-x-auto shadow-sm rounded">
              <table className="w-full text-[12.5px] table-fixed min-w-[1000px]">
                <colgroup>
                  <col className="w-[180px]" />
                  <col className="w-[100px]" />
                  <col className="w-[120px]" />
                  <col className="w-[180px]" />
                  <col className="w-[160px]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px] border-b border-border-default">
                    <th className="px-4 py-2.5 font-semibold">Proposal ID</th>
                    <th className="px-4 py-2.5 font-semibold">Section</th>
                    <th className="px-4 py-2.5 font-semibold">Departments</th>
                    <th className="px-4 py-2.5 font-semibold">Proposed Window</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Audit Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {rejectedProposals.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-[12px] font-bold text-text-primary">
                        {p.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-bold">
                          {p.section_id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.departments.map((d) => (
                            <DepartmentBadge key={d} dept={d as any} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-text-secondary font-mono">
                        {formatTime(p.proposed_start_time)} – {formatTime(p.proposed_end_time)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-critical/10 text-critical text-[11px] font-bold uppercase">
                          <XCircle size={10} /> REJECTED
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11.5px] text-text-secondary">
                        Declined by Section Controller during shift review
                      </td>
                    </tr>
                  ))}
                  {rejectedProposals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-text-secondary text-[12.5px]">
                        No rejected block proposals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: BUNDLE APPROVAL CONFIRMATION ──────────────────────────── */}
      {confirmApproveProposal && (() => {
        const { startKm, endKm, trackLine, leadDept, constituentBlocks } = computeProposalKmBounds(
          confirmApproveProposal,
          blocks,
          topology,
        );
        const riskMetrics = getProposalRiskMetrics(confirmApproveProposal, constituentBlocks);

        return (
          <ApprovalConfirmModal
            proposal={confirmApproveProposal}
            constituentBlocks={constituentBlocks}
            startKm={startKm}
            endKm={endKm}
            trackLine={trackLine}
            leadDept={leadDept}
            riskMetrics={riskMetrics}
            onConfirm={() => executeApprove(confirmApproveProposal)}
            onClose={() => setConfirmApproveProposal(null)}
            loading={actionLoading}
          />
        );
      })()}

      {/* ─── MODAL 2: BATCH APPROVAL CONFIRMATION ────────────────────────────── */}
      {isBatchApproveOpen && eligibleSelectedProposals.length > 0 && (
        <BatchApprovalConfirmModal
          selectedProposals={eligibleSelectedProposals}
          onConfirm={executeBatchApprove}
          onClose={() => setIsBatchApproveOpen(false)}
          loading={actionLoading}
          progressText={batchProgressText}
        />
      )}

      {/* ─── MODAL 3: ADJUST MODAL (GENUINE HUMAN OVERRIDE) ─────────────────── */}
      {adjustTargetProposal && (() => {
        const { startKm, endKm, trackLine, leadDept } = computeProposalKmBounds(
          adjustTargetProposal,
          blocks,
          topology,
        );

        return (
          <AdjustModal
            proposal={adjustTargetProposal}
            initialStartKm={startKm}
            initialEndKm={endKm}
            initialTrackLine={trackLine}
            initialLeadDept={leadDept}
            onConfirm={executeAdjust}
            onClose={() => setAdjustTargetProposal(null)}
            loading={actionLoading}
          />
        );
      })()}

      {/* ─── MODAL 4: REJECT MODAL ───────────────────────────────────────────── */}
      {rejectTargetProposal && (
        <RejectModal
          proposal={rejectTargetProposal}
          onConfirm={executeReject}
          onClose={() => setRejectTargetProposal(null)}
          loading={actionLoading}
        />
      )}
    </>
  );
}
