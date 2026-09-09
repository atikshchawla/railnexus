"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout";
import {
  mockBlocks,
  mockConflicts,
  mockTrainPaths,
} from "@/lib/mock-data";
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

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimeOnly(isoString: string) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getConflictStatusForTrain(trainId: string, derivedConflicts: any[]) {
  const conflicts = derivedConflicts.filter(c => c.trainId === trainId);
  return conflicts;
}

export default function OverviewPage() {
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());

  // ─── Data Prep ─────────────────────────────────────────────────────

  const criticalBlocks = mockBlocks.filter(b => b.urgency.tier === "critical" && b.status !== "Closed");
  const unacknowledgedCritical = criticalBlocks.filter(b => !acknowledgedAlerts.has(b.id));

  const unresolvedConflicts = mockConflicts.filter(c => c.status === "Unresolved")
    .sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime());

  const pendingApprovals = mockBlocks.filter(b => b.status === "Under review" || b.status === "Submitted");
  const activeApproved = mockBlocks.filter(b => b.status === "Active" || b.status === "Approved");

  const blocksWithAI = mockBlocks.filter(b => b.aiSuggestion !== null && b.status === "Under review");

  // Since computeConflicts requires ChartBlock format, we adapt mockBlocks for the engine temporarily
  const chartBlocks = useMemo(() => mockBlocks.map(b => ({
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
  }) as any), []);

  const derivedConflicts = useMemo(() => computeConflicts(chartBlocks, mockTrainPaths), [chartBlocks]);

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
        subtitle="Section: Ambala–Saharanpur, Northern Railway"
      />

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

      <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-canvas">
        {/* Row 1: Clickable KPI tiles */}
        <div className="grid grid-cols-4 gap-px bg-border-default border border-border-default">
          <Link href="/backlog" className="bg-surface p-3 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12px] text-text-secondary mb-0.5">Open backlog items</p>
            <p className={`text-[26px] font-semibold leading-none num ${criticalBlocks.length > 0 ? "text-critical" : "text-text-primary"}`}>
              {mockBlocks.length}
            </p>
            <p className="text-[11px] text-text-secondary mt-1">{criticalBlocks.length} critical</p>
          </Link>
          <Link href="/conflicts" className="bg-surface p-3 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12px] text-text-secondary mb-0.5">Unresolved conflicts</p>
            <p className={`text-[26px] font-semibold leading-none num ${unresolvedConflicts.length > 0 ? "text-critical" : "text-text-primary"}`}>
              {unresolvedConflicts.length}
            </p>
            <p className="text-[11px] text-text-secondary mt-1">Cross-department overlaps</p>
          </Link>
          <Link href="/approvals" className="bg-surface p-3 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12px] text-text-secondary mb-0.5">Pending approvals</p>
            <p className="text-[26px] font-semibold text-warning leading-none num">{pendingApprovals.length}</p>
            <p className="text-[11px] text-text-secondary mt-1">Sorted by urgency</p>
          </Link>
          <Link href="/plan" className="bg-surface p-3 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12px] text-text-secondary mb-0.5">Today&apos;s blocks</p>
            <p className="text-[26px] font-semibold text-text-primary leading-none num">{activeApproved.length}</p>
            <p className="text-[11px] text-text-secondary mt-1">Active / Approved</p>
          </Link>
        </div>

        {/* Row 2: Two-column */}
        <div className="grid grid-cols-[minmax(320px,1fr)_minmax(480px,1.5fr)] gap-4">
          
          {/* Left column: Conflicts */}
          <div className="bg-surface border border-border-default h-min">
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
            <div className="divide-y divide-border-default">
              {unresolvedConflicts.slice(0, 2).map((c) => {
                const blockA = mockBlocks.find(b => b.id === c.blockAId)!;
                const blockB = mockBlocks.find(b => b.id === c.blockBId)!;
                return (
                  <Link key={c.id} href={`/conflicts#${c.id}`} className="block px-3 py-2.5 hover:bg-surface-sunken/50">
                    <div className="flex items-center gap-2 mb-1">
                      <DepartmentBadge dept={blockA.department} />
                      <span className="text-[11px] text-text-secondary font-medium">vs</span>
                      <DepartmentBadge dept={blockB.department} />
                      <span className="ml-auto text-[11px] font-medium text-critical">{formatTimeOnly(c.windowStart)}</span>
                    </div>
                    <p className="text-[12px] font-medium text-text-primary truncate">
                      {c.overlapDescription}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">
                      {blockA.id} &middot; {blockB.id}
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

          {/* Right column: AI suggestions as reasoning-first cards */}
          <div className="bg-surface border border-border-default h-min">
            <div className="px-3 py-2 border-b border-border-default flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-text-primary">
                AI suggestions
              </h3>
              <span className="text-[11px] text-text-secondary">
                System-generated — review required
              </span>
            </div>
            <div className="divide-y divide-border-default bg-surface-sunken/30">
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

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {!isEligible && (
                        <span className="text-[11px] text-critical font-medium mr-auto">
                          Has unresolved conflict — resolve in Conflicts before approval.
                        </span>
                      )}
                      <button className="px-3 py-1.5 text-[12px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors">
                        Reject
                      </button>
                      <button 
                        disabled={!hasExpanded || !isEligible}
                        title={!isEligible ? "Cannot approve unresolved conflict" : !hasExpanded ? "Expand reasoning to enable approval" : "Approve with AI recommendation"}
                        className="px-3 py-1.5 text-[12px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3: Timetable */}
        <div className="bg-surface border border-border-default mt-4">
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
              {mockTrainPaths.map((t) => {
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
                      {new Date(new Date().setHours(0,0,0,0) + t.stops[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        </div>
        
        {/* Footer meta line */}
        <div className="text-center pt-2 pb-6">
          <p className="text-[11px] text-text-secondary">
            Last synced: {formatRelativeTime(new Date().toISOString())} from TMS/SMMS/TDMS
          </p>
        </div>
      </div>
    </>
  );
}
