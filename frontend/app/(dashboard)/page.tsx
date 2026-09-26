"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout";
import { computeConflicts } from "@/lib/chart-engine";
import {
  DepartmentBadge,
  UrgencyText,
  ConflictIndicator,
  ConfidenceDisplay,
} from "@/components/shared";
import {
  AlertTriangle,
  ArrowRight,
  Train,
  Truck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/rules";
import { useDashboardData } from "@/lib/dashboard-context";
import type { ChartBlock, DerivedConflict } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimeOnly(isoString: string) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getConflictStatusForTrain(trainId: string, derivedConflicts: DerivedConflict[]) {
  const conflicts = derivedConflicts.filter(c => c.trainId === trainId);
  return conflicts;
}

export default function OverviewPage() {
  const { data, loading, error } = useDashboardData();
  const { blocks, conflicts, serverConflicts, proposals, operationalBlocks, trains: trainPaths } = data;
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ─── Data Prep ─────────────────────────────────────────────────────

  const criticalBlocks = blocks.filter(b => b.urgency.tier === "critical" && b.status !== "Closed");
  const unacknowledgedCritical = criticalBlocks.filter(b => !acknowledgedAlerts.has(b.id));

  const unresolvedConflicts = conflicts.filter(c => c.status === "Unresolved")
    .sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime());

  const pendingProposalCount = proposals.length > 0
    ? proposals.filter(p => p.status === "PROPOSED" || (!p.operational_block_id && p.status !== "REJECTED")).length
    : blocks.filter(b => b.status === "Under review" || b.status === "Submitted").length;

  const activeApprovedCount = operationalBlocks.length > 0
    ? operationalBlocks.length
    : blocks.filter(b => b.status === "Active" || b.status === "Approved").length;

  const blocksWithAI = blocks.filter(b => b.aiSuggestion !== null && (b.status === "Under review" || b.status === "Submitted"));

  // The chart engine consumes a compact view of each live maintenance block.
  const chartBlocks = useMemo<ChartBlock[]>(() => blocks.map(b => ({
    id: b.id,
    department: b.department,
    km_start: b.location.kmStart,
    km_end: b.location.kmEnd,
    time_start: new Date(b.scheduledWindow.start).getTime() - new Date().setHours(0,0,0,0), // relative to midnight
    time_end: new Date(b.scheduledWindow.end).getTime() - new Date().setHours(0,0,0,0),
    status: b.status.toLowerCase(),
    isShadow: false,
    label: b.description,
    priorityTier: b.urgency.tier === "critical" ? "P1-critical" : "P4-low"
  }) as ChartBlock), [blocks]);

  const derivedConflicts = useMemo(() => computeConflicts(chartBlocks, trainPaths), [chartBlocks, trainPaths]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleAcknowledge = () => {
    const newSet = new Set(acknowledgedAlerts);
    unacknowledgedCritical.forEach(b => newSet.add(b.id));
    setAcknowledgedAlerts(newSet);
  };

  const handleReasoningExpanded = (blockId: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      next.add(blockId);
      return next;
    });
  };

  return (
    <>
      <TopBar
        title="Overview"
        subtitle="Section: Chennai division, Southern Railway"
      />

      {error && (
        <div className="flex items-center justify-between gap-4 border-b border-warning bg-warning/10 px-4 py-2 text-[12px] text-text-primary">
          <span>Backend sync failed: {error}</span>
          <span className="font-medium text-warning">API offline</span>
        </div>
      )}
      {loading && (
        <div className="border-b border-border-default bg-surface-sunken px-4 py-2 text-[12px] text-text-secondary">
          Syncing live maintenance, topology, train, and ML records...
        </div>
      )}

      {/* Critical alert banner (Rule R4 / R5) */}
      {criticalBlocks.length > 0 && (
        <div className={`flex items-center text-[13px] font-medium border-b ${
          unacknowledgedCritical.length > 0 
            ? "bg-critical text-white border-critical" 
            : "bg-surface text-critical border-critical"
        }`}>
          <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5">
            <AlertTriangle size={15} strokeWidth={2} />
            <span>
              {criticalBlocks.length} critical item{criticalBlocks.length > 1 ? "s" : ""} require attention — {criticalBlocks[0].description}
            </span>
            {unacknowledgedCritical.length === 0 && (
              <span className="text-text-secondary font-normal ml-2 italic">
                (Acknowledged by you · just now)
              </span>
            )}
          </div>
          {unacknowledgedCritical.length > 0 && (
            <button
              onClick={handleAcknowledge}
              className="px-4 py-2.5 font-bold hover:bg-white/10 transition-colors uppercase tracking-wider text-[11px]"
            >
              Acknowledge
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-canvas">
        {/* Row 1: KPI tiles */}
        <div className="shrink-0 px-5 pt-5">
          <div className="grid grid-cols-4 gap-4">
            <Link href="/backlog" className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/30 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">Open backlog</p>
              </div>
              <p className={`text-[32px] font-black leading-none num tracking-tight ${criticalBlocks.length > 0 ? "text-critical" : "text-text-primary"}`}>
                {blocks.length}
              </p>
              <p className={`text-[12px] mt-2 font-medium ${criticalBlocks.length > 0 ? "text-critical" : "text-text-secondary"}`}>
                {criticalBlocks.length} critical items
              </p>
            </Link>
            
            <Link href="/conflicts" className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/30 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">Conflicts</p>
              </div>
              <p className={`text-[32px] font-black leading-none num tracking-tight ${unresolvedConflicts.length > 0 ? "text-critical" : "text-text-primary"}`}>
                {unresolvedConflicts.length}
              </p>
              <p className={`text-[12px] mt-2 font-medium ${unresolvedConflicts.length > 0 ? "text-critical" : "text-text-secondary"}`}>
                Cross-department overlaps
              </p>
            </Link>

            <Link href="/approvals" className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/30 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">Pending approvals</p>
              </div>
              <p className="text-[32px] font-black text-warning leading-none num tracking-tight">
                {pendingProposalCount}
              </p>
              <p className="text-[12px] mt-2 font-medium text-warning">
                Awaiting controller decision
              </p>
            </Link>

            <Link href="/plan" className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/30 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">Today's plan</p>
              </div>
              <p className="text-[32px] font-black text-positive leading-none num tracking-tight">
                {activeApprovedCount}
              </p>
              <p className="text-[12px] mt-2 font-medium text-positive">
                Active & Approved blocks
              </p>
            </Link>
          </div>
        </div>

        {/* Row 2: Two-column — fills all remaining height */}
        <div className="flex-1 min-h-0 px-4 pt-4 flex gap-4 overflow-hidden">
          
          {/* Left column: Conflicts — fills column height, scrolls inside */}
          <div className="w-[320px] shrink-0 bg-surface border border-border-default flex flex-col min-h-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-border-default flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} strokeWidth={1.75} className="text-critical" />
                <h3 className="text-[14px] font-semibold text-text-primary">
                  Unresolved conflicts
                </h3>
              </div>
              <Link href="/conflicts" className="text-[11px] text-brand font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="divide-y divide-border-default overflow-y-auto flex-1">
              {unresolvedConflicts.slice(0, 4).map((c) => {
                const blockA = blocks.find((b) => b.id === c.blockAId);
                const blockB = blocks.find((b) => b.id === c.blockBId);
                return (
                  <Link key={c.id} href={`/conflicts#${c.id}`} className="block px-3 py-2.5 hover:bg-surface-sunken/50">
                    <div className="flex items-center gap-2 mb-1">
                      {blockA ? <DepartmentBadge dept={blockA.department} /> : <span className="text-[10px] font-semibold text-brand">PROPOSAL</span>}
                      <span className="text-[11px] text-text-secondary font-medium">vs</span>
                      {blockB ? <DepartmentBadge dept={blockB.department} /> : <span className="text-[10px] font-semibold text-warning">TRAIN</span>}
                      <span className="ml-auto text-[11px] font-medium text-critical">{formatTimeOnly(c.windowStart)}</span>
                    </div>
                    <p className="text-[12px] font-medium text-text-primary truncate">
                      {c.overlapDescription}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">
                      {c.blockAId} &middot; {c.blockBId}
                    </p>
                  </Link>
                );
              })}
              {unresolvedConflicts.length === 0 && (
                <div className="p-4 text-center text-[12px] text-text-secondary">
                  No unresolved conflicts.
                </div>
              )}
            </div>
          </div>

          {/* Right column: AI suggestions — fills remaining width, scrolls inside */}
          <div className="flex-1 min-w-0 bg-surface border border-border-default flex flex-col min-h-0 overflow-hidden rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-border-default flex items-center justify-between bg-surface-sunken/40">
              <h3 className="text-[15px] font-bold text-text-primary">
                AI ML Suggestions
              </h3>
              <span className="text-[12px] font-medium text-text-secondary bg-surface px-2 py-1 rounded shadow-xs border border-border-default">
                Review required
              </span>
            </div>
            <div className="divide-y divide-border-default bg-surface-sunken/30 flex-1 min-h-0 overflow-y-auto">
              {blocksWithAI.map(block => {
                const hasExpanded = expandedReasoning.has(block.id);
                // Check if it's eligible for batch (no unresolved conflicts)
                const isEligible = !block.conflict || block.conflict.status === "Resolved";

                return (
                  <div key={block.id} className="p-3 space-y-3 bg-surface">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[12px] font-medium text-text-primary">{block.id}</span>
                          <DepartmentBadge dept={block.department} />
                          {block.conflict && block.conflict.status === "Unresolved" && (
                            <ConflictIndicator conflictId={block.conflict.conflictId} />
                          )}
                        </div>
                        <p className="text-[13px] text-text-primary font-medium">{block.description}</p>
                        <p className="text-[11px] text-text-secondary mt-0.5">
                          Km {block.location.kmStart}-{block.location.kmEnd} ({block.location.line}) &middot; {formatTimeOnly(block.scheduledWindow.start)}–{formatTimeOnly(block.scheduledWindow.end)}
                        </p>
                      </div>
                      <UrgencyText tier={block.urgency.tier} text={`${block.urgency.timeToBreachHours ?? 'No'} hr SLA`} />
                    </div>

                    <div className="bg-surface-sunken p-2.5 border border-border-default rounded-[4px]">
                      <ConfidenceDisplay 
                        aiSuggestion={block.aiSuggestion!} 
                        onExpanded={() => handleReasoningExpanded(block.id)} 
                      />
                    </div>

                    {block.mlPrediction && (
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border-default border border-border-default text-[11px]">
                        <div className="bg-surface px-2.5 py-2"><dt className="text-text-secondary">Failure risk</dt><dd className="num font-semibold">{(block.mlPrediction.failureRiskProbability * 100).toFixed(1)}%</dd></div>
                        <div className="bg-surface px-2.5 py-2"><dt className="text-text-secondary">Duration</dt><dd className="num font-semibold">{Math.round(block.mlPrediction.predictedDurationMinutes)} min</dd></div>
                        <div className="bg-surface px-2.5 py-2"><dt className="text-text-secondary">Overrun risk</dt><dd className="num font-semibold">{(block.mlPrediction.overrunProbability * 100).toFixed(1)}%</dd></div>
                        <div className="bg-surface px-2.5 py-2"><dt className="text-text-secondary">Train delay</dt><dd className="num font-semibold">{Math.round(block.mlPrediction.totalDelayMinutes)} min</dd></div>
                      </dl>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border-default/50">
                      {!isEligible ? (
                        <span className="text-[12px] text-critical font-bold flex items-center gap-1.5">
                          <AlertTriangle size={14} /> Resolve conflict before approval
                        </span>
                      ) : (
                        <span className="text-[12px] text-success font-bold flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Ready for review
                        </span>
                      )}
                      
                      <Link
                        href={`/ai-insights?request_id=${encodeURIComponent(block.id)}`}
                        className="px-4 py-1.5 text-[12px] font-bold bg-brand text-white hover:bg-brand-hover transition-colors rounded shadow-sm inline-flex items-center gap-1.5"
                      >
                        Review Request <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3: Timetable — pinned to bottom */}
        <div className="shrink-0 bg-surface border border-border-default mx-4 mb-4 mt-4">
          <div className="px-3 py-2 border-b border-border-default">
            <h3 className="text-[14px] font-semibold text-text-primary">
              Today&apos;s train timetable
            </h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wide text-[10px]">
                <th scope="col" className="px-3 py-2 font-medium w-10">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Train ID</th>
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">Start Time</th>
                <th scope="col" className="px-3 py-2 font-medium">Conflict Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {trainPaths.map((t) => {
                const conflicts = getConflictStatusForTrain(t.id, derivedConflicts);
                const isFreight = t.type === "Freight";
                
                return (
                  <tr key={t.id} className="hover:bg-surface-sunken/50 cursor-pointer" onClick={() => window.location.href = `/plan?focus=${t.id}`}>
                    <td className="px-3 py-2">
                      {isFreight ? (
                        <Truck size={14} strokeWidth={1.75} className="text-text-secondary" />
                      ) : (
                        <Train size={14} strokeWidth={1.75} className="text-brand" />
                      )}
                    </td>
                    <td className="px-3 py-2 num font-medium">{t.id}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2 text-right num">
                      {t.stops[0] ? new Date(new Date().setHours(0,0,0,0) + t.stops[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                    </td>
                    <td className="px-3 py-2">
                      {conflicts.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-critical font-medium">
                          <AlertTriangle size={14} strokeWidth={2} />
                          {conflicts.length} block overlap{conflicts.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-success font-medium">
                          <CheckCircle2 size={14} strokeWidth={2} />
                          Clear
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-1.5 border-t border-border-default text-center">
            <p className="text-[10px] text-text-secondary">
              Last synced: {isMounted ? formatRelativeTime(new Date().toISOString()) : "Just now"} from TMS/SMMS/TDMS
            </p>
          </div>
        </div>
        
      </div>
    </>
  );
}
