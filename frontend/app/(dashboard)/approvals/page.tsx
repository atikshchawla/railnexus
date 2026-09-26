"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
  Check,
} from "lucide-react";
import type { ApprovalProposalRecord, ProposalApprovePayload } from "@/lib/types";
import { approveProposal, rejectProposal } from "@/lib/api";
import {
  computeProposalKmBounds,
  getProposalRiskMetrics,
  formatTime,
  formatDate,
  getShortProposalId,
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
  const searchParams = useSearchParams();
  const focusId = searchParams.get("block_id") || searchParams.get("focus");

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

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDrawerProposal, setSelectedDrawerProposal] = useState<ApprovalProposalRecord | null>(null);

  const handleOpenDrawer = (proposal: ApprovalProposalRecord) => {
    setSelectedDrawerProposal(proposal);
    setDrawerOpen(true);
  };

  // Auto-open focused proposal in drawer
  const handledFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || proposals.length === 0) return;
    if (handledFocusRef.current === focusId) return;

    const target = proposals.find(
      (p) =>
        p.id === focusId ||
        (p.maintenance_request_ids && p.maintenance_request_ids.includes(focusId)) ||
        p.operational_block_id === focusId,
    );
    if (target) {
      handledFocusRef.current = focusId;
      if (target.status === "ACCEPTED" || target.status === "OVERRIDDEN") {
        setActiveTab("approved");
      } else if (target.status === "REJECTED") {
        setActiveTab("rejected");
      } else {
        setActiveTab("pending");
      }
      handleOpenDrawer(target);
      setExpandedProposalIds((prev) => new Set([...prev, target.id]));
    }
  }, [focusId, proposals]);

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

        {/* Top Status Summary */}
        <div className="shrink-0 px-6 py-4 bg-surface border-b border-border-default flex items-center justify-between">
          <div className="flex gap-6">
            <button onClick={() => setActiveTab("pending")} className={`flex flex-col text-left transition-colors ${activeTab === "pending" ? "text-brand" : "text-text-secondary hover:text-text-primary"}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Awaiting Decision</span>
              <span className="text-[24px] font-black leading-none">{pendingProposals.length}</span>
            </button>
            <div className="w-px h-10 bg-border-default mx-2" />
            <button onClick={() => setActiveTab("approved")} className={`flex flex-col text-left transition-colors ${activeTab === "approved" ? "text-positive" : "text-text-secondary hover:text-text-primary"}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Operational Possessions</span>
              <span className="text-[24px] font-black leading-none">{operationalBlocks.length}</span>
            </button>
            <div className="w-px h-10 bg-border-default mx-2" />
            <button onClick={() => setActiveTab("rejected")} className={`flex flex-col text-left transition-colors ${activeTab === "rejected" ? "text-critical" : "text-text-secondary hover:text-text-primary"}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Rejected</span>
              <span className="text-[24px] font-black leading-none">{rejectedProposals.length}</span>
            </button>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5">Combined Possession Saving</span>
            <span className="text-[24px] font-black text-text-primary leading-none">
              {pendingProposals.reduce((sum, p) => sum + (p.possession_saving_minutes || 0), 0).toFixed(0)} <span className="text-[14px] font-semibold text-text-secondary">min</span>
            </span>
          </div>
        </div>

        {/* ─── MAIN WORKSPACE: Queue + Drawer ───────────────────────────────── */}
        <div className="flex-1 min-h-0 flex">
          {/* Main Queue Column */}
          <div className="flex-1 min-w-0 flex flex-col">

        {/* ─── TAB 1: AWAITING DECISION ───────────────────────────────────────── */}
        {activeTab === "pending" && (
          <div className="flex-1 min-h-0 flex flex-col bg-canvas border-r border-border-default">

            {/* Triage & Operational Filter Bar */}
            <div className="shrink-0 bg-surface border-b border-border-default px-6 py-3 flex items-center justify-between gap-4 flex-wrap text-[12px]">
              {/* Left: Triage Pills & Status Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mr-2">Triage</span>

                {/* All */}
                <button onClick={() => setRiskFilter("all")} className={`px-3 py-1.5 rounded text-[11.5px] font-bold transition-all cursor-pointer ${riskFilter === "all" ? "bg-surface-sunken text-text-primary shadow-xs border border-border-default" : "text-text-secondary hover:text-text-primary"}`}>All {riskCounts.total}</button>
                {/* Needs Attention */}
                <button onClick={() => setRiskFilter("attention")} className={`px-3 py-1.5 rounded text-[11.5px] font-bold transition-all cursor-pointer ${riskFilter === "attention" ? "bg-amber-500/10 text-amber-600 shadow-xs border border-amber-500/30" : "text-text-secondary hover:text-text-primary"}`}>Needs Attention {riskCounts.attentionCount}</button>
                {/* Clear */}
                <button onClick={() => setRiskFilter("clear")} className={`px-3 py-1.5 rounded text-[11.5px] font-bold transition-all cursor-pointer ${riskFilter === "clear" ? "bg-positive/10 text-positive shadow-xs border border-positive/30" : "text-text-secondary hover:text-text-primary"}`}>Clear {riskCounts.clearCount}</button>
                {/* Blocked */}
                <button onClick={() => setRiskFilter("blocked")} className={`px-3 py-1.5 rounded text-[11.5px] font-bold transition-all cursor-pointer ${riskFilter === "blocked" ? "bg-critical/10 text-critical shadow-xs border border-critical/30" : "text-text-secondary hover:text-text-primary"}`}>Blocked {riskCounts.blockedCount}</button>

                <div className="h-5 w-px bg-border-default mx-3" />

                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mr-2">Filter</span>
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-surface border border-border-default px-3 py-1.5 text-text-primary font-medium focus:ring-0 cursor-pointer rounded text-[11.5px] shadow-xs">
                  <option value="All">Department</option>
                  <option value="ENGG">ENGG</option>
                  <option value="TRD">TRD</option>
                  <option value="S&T">S&T</option>
                </select>

                <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="bg-surface border border-border-default px-3 py-1.5 text-text-primary font-medium focus:ring-0 cursor-pointer rounded text-[11.5px] shadow-xs">
                  <option value="All">Section</option>
                  {uniqueSections.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                </select>
                
                {(deptFilter !== "All" || sectionFilter !== "All" || riskFilter !== "all") && (
                  <button onClick={() => {setDeptFilter("All"); setSectionFilter("All"); setRiskFilter("all");}} className="px-2 py-1.5 text-[11px] font-bold text-critical hover:underline">Clear Filters</button>
                )}
              </div>

              {/* Right: Sort Dropdown & Queue Metric */}
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2 text-text-secondary text-[11.5px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Sort</span>
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="bg-surface border border-border-default px-3 py-1.5 text-text-primary font-medium focus:ring-0 cursor-pointer rounded text-[11.5px] shadow-xs">
                    <option value="soonest">Soonest Window</option>
                    <option value="lowest_confidence">Highest Risk</option>
                    <option value="highest_saving">Highest Saving</option>
                    <option value="needs_attention">Needs Attention</option>
                  </select>
                </div>
                <div className="text-[11.5px] text-text-secondary pl-4 border-l border-border-default">
                  Showing {filteredAndSortedPending.length} of {pendingProposals.length}
                </div>
                <button onClick={() => refresh()} disabled={actionLoading} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface border border-border-default rounded shadow-xs cursor-pointer transition-all" title="Refresh queue">
                  <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Main Queue List */}
            <div className="flex-1 overflow-y-auto bg-canvas p-6 space-y-3">
              {filteredAndSortedPending.length === 0 ? (
                <div className="text-center text-text-secondary py-12 bg-surface rounded-xl border border-border-default shadow-sm">
                  <h3 className="text-[16px] font-bold text-text-primary mb-2">NO PENDING APPROVALS</h3>
                  <p>All maintenance block proposals have been reviewed or none match the current filters.</p>
                </div>
              ) : (
                filteredAndSortedPending.map((p) => (
                  <ProposalRow
                    key={p.id}
                    proposal={p}
                    blocks={blocks}
                    topology={topology}
                    isSelected={selectedProposalIds.has(p.id)}
                    onReview={() => handleOpenDrawer(p)}
                  />
                ))
              )}
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

          {/* Right Drawer */}
          {drawerOpen && selectedDrawerProposal && (() => {
            const { startKm, endKm, trackLine, constituentBlocks } = computeProposalKmBounds(selectedDrawerProposal, blocks, topology);
            const riskMetrics = getProposalRiskMetrics(selectedDrawerProposal, constituentBlocks);
            const reqCount = selectedDrawerProposal.maintenance_request_ids.length;

            return (
              <div className="w-[420px] shrink-0 bg-surface border-l border-border-default flex flex-col shadow-xl z-20 animate-in slide-in-from-right duration-200">
                
                {/* Drawer Header */}
                <div className="px-5 py-4 border-b border-border-default bg-surface-sunken flex justify-between items-start">
                  <div>
                    <h3 className="text-[16px] font-black text-text-primary tracking-tight">
                      BLOCK {getShortProposalId(selectedDrawerProposal.id)}
                    </h3>
                    <div className="text-[11.5px] font-bold uppercase tracking-wider text-text-secondary mt-1 flex items-center gap-2">
                      <span className="bg-brand/10 text-brand px-1.5 rounded">{selectedDrawerProposal.section_id}</span>
                      <span>Km {startKm.toFixed(1)}–{endKm.toFixed(1)}</span>
                    </div>
                  </div>
                  <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-text-secondary hover:text-text-primary bg-canvas border border-border-default rounded cursor-pointer transition-colors">
                    <XCircle size={15} />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 text-[12px]">
                  
                  {/* Time & Saving */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Time Window</div>
                      <div className="text-[13px] font-mono font-bold text-text-primary">
                        {formatTime(selectedDrawerProposal.proposed_start_time)} → {formatTime(selectedDrawerProposal.proposed_end_time)}
                      </div>
                      <div className="text-[11px] text-text-secondary font-mono mt-0.5">
                        {selectedDrawerProposal.predicted_duration_minutes.toFixed(0)} mins
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Possession Saving</div>
                      <div className="text-[13px] font-mono font-bold text-positive bg-positive/10 px-2 py-0.5 rounded w-max">
                        +{selectedDrawerProposal.possession_saving_minutes.toFixed(0)} min
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border-default w-full" />

                  {/* AI Assessment */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">AI / Operational Assessment</div>
                    
                    <div className={`p-3 rounded border ${riskMetrics.isBlocked ? 'bg-critical/10 border-critical/30' : riskMetrics.needsAttention ? 'bg-amber-500/10 border-amber-500/30' : 'bg-positive/10 border-positive/30'}`}>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        {riskMetrics.isBlocked ? <AlertTriangle size={14} className="text-critical"/> : riskMetrics.needsAttention ? <AlertTriangle size={14} className="text-amber-600"/> : <ShieldCheck size={14} className="text-positive"/>}
                        <span className={riskMetrics.isBlocked ? "text-critical" : riskMetrics.needsAttention ? "text-amber-600" : "text-positive"}>
                          {riskMetrics.statusLabel} · {riskMetrics.confidence}% Confidence
                        </span>
                      </div>
                      <p className={`text-[11px] ${riskMetrics.isBlocked ? "text-critical" : riskMetrics.needsAttention ? "text-amber-600" : "text-positive"}`}>{riskMetrics.reason}</p>
                    </div>

                    <div className="space-y-2 text-[11.5px] text-text-primary">
                      <div className="flex items-center justify-between"><span className="text-text-secondary">Compatible section</span> <Check size={14} className="text-positive"/></div>
                      <div className="flex items-center justify-between"><span className="text-text-secondary">Spatially compatible</span> <Check size={14} className="text-positive"/></div>
                      <div className="flex items-center justify-between"><span className="text-text-secondary">Equipment conflict</span> {riskMetrics.isBlocked ? <XCircle size={14} className="text-critical"/> : <Check size={14} className="text-positive"/>}</div>
                    </div>
                  </div>

                  <div className="h-px bg-border-default w-full" />

                  {/* Requests */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-3">Requests ({reqCount})</div>
                    <div className="space-y-2">
                      {constituentBlocks.map((b, i) => (
                        <div key={b.id} className="p-2.5 border border-border-default bg-canvas rounded flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-brand text-[11px]">{b.id}</span>
                            <DepartmentBadge dept={b.department} />
                          </div>
                          <span className="font-medium text-[11px]">{b.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Drawer Footer Actions */}
                <div className="px-5 py-4 border-t border-border-default bg-surface-sunken flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (!riskMetrics.isBlocked) setConfirmApproveProposal(selectedDrawerProposal);
                    }}
                    disabled={actionLoading || riskMetrics.isBlocked}
                    className={`w-full py-2.5 text-[12px] font-bold rounded shadow-xs flex items-center justify-center gap-2 transition-colors ${riskMetrics.isBlocked ? 'bg-surface border border-border-default text-text-secondary opacity-50 cursor-not-allowed' : 'bg-brand text-white hover:bg-brand-hover cursor-pointer'}`}
                  >
                    <CheckSquare size={14} /> Approve Block
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAdjustTargetProposal(selectedDrawerProposal)}
                      disabled={actionLoading}
                      className="flex-1 py-2 text-[11px] font-bold rounded border border-amber-500/40 text-amber-600 hover:bg-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <SlidersHorizontal size={12} /> Adjust
                    </button>
                    <button
                      onClick={() => setRejectTargetProposal(selectedDrawerProposal)}
                      disabled={actionLoading}
                      className="flex-1 py-2 text-[11px] font-bold rounded border border-critical/30 text-critical hover:bg-critical/10 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>

              </div>
            );
          })()}

        </div>

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
