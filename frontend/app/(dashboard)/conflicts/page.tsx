"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout";
import { SearchBar } from "@/components/shared";
import { useDashboardData } from "@/lib/dashboard-context";
import { computeConflicts } from "@/lib/chart-engine";
import { DepartmentBadge, UrgencyBorder } from "@/components/shared";
import { AlertTriangle, ArrowRightLeft, Merge, Eye, ArrowUpRight, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/rules";
import type { ConflictRecord, Department } from "@/lib/types";
import { detectConflicts } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTime(isoString?: string) {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getConflictSeverityColor(severity: string) {
  const s = (severity || "").toLowerCase();
  switch (s) {
    case "critical":
    case "high":
      return "critical";
    case "medium":
    case "warning":
      return "warning";
    case "low":
    case "caution":
      return "caution";
    default:
      return "routine";
  }
}

// ─── Modal Component ──────────────────────────────────────────────────

function PreviewModal({
  conflict,
  blocks,
  trainPaths,
  actionName,
  onClose,
  onConfirm,
}: {
  conflict: ConflictRecord;
  blocks: ReturnType<typeof useDashboardData>["data"]["blocks"];
  trainPaths: ReturnType<typeof useDashboardData>["data"]["trains"];
  actionName: "Merge" | "Sequence";
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");

  const blockA = blocks.find((b) => b.id === conflict.blockAId);
  const blockB = blocks.find((b) => b.id === conflict.blockBId);

  // Compute combined window safely
  const startA = blockA ? new Date(blockA.scheduledWindow.start).getTime() : Date.now();
  const endA = blockA ? new Date(blockA.scheduledWindow.end).getTime() : Date.now() + 7200000;
  const startB = blockB ? new Date(blockB.scheduledWindow.start).getTime() : Date.now();
  const endB = blockB ? new Date(blockB.scheduledWindow.end).getTime() : Date.now() + 7200000;

  const combinedStart = actionName === "Merge" ? Math.min(startA, startB) : Math.min(startA, startB);
  const combinedEnd =
    actionName === "Merge"
      ? Math.max(endA, endB)
      : startA < startB
        ? endA + (endB - startB)
        : endB + (endA - startA);

  const leadDept =
    blockA && blockB
      ? blockA.urgency.timeToBreachHours !== null && blockB.urgency.timeToBreachHours !== null
        ? blockA.urgency.timeToBreachHours < blockB.urgency.timeToBreachHours
          ? blockA.department
          : blockB.department
        : blockA.department
      : blockA?.department || blockB?.department || ("Engg" as Department);

  // Check affected trains using chart engine logic
  const mockChartBlocks = blockA
    ? [
        {
          id: "COMBINED",
          department: leadDept,
          km_start: blockB ? Math.min(blockA.location.kmStart, blockB.location.kmStart) : blockA.location.kmStart,
          km_end: blockB ? Math.max(blockA.location.kmEnd, blockB.location.kmEnd) : blockA.location.kmEnd,
          time_start: combinedStart - new Date().setHours(0, 0, 0, 0),
          time_end: combinedEnd - new Date().setHours(0, 0, 0, 0),
          status: "active" as const,
          isShadow: false,
          label: "Combined",
          priorityTier: "P1-critical" as any,
        },
      ]
    : [];

  const newlyAffectedTrains =
    mockChartBlocks.length > 0
      ? computeConflicts(mockChartBlocks, trainPaths)
          .map((c) => trainPaths.find((t) => t.id === c.trainId))
          .filter(Boolean)
      : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface border border-border-default max-w-lg w-full shadow-lg flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text-primary">
            Preview: {actionName} {conflict.id}
          </h2>
        </div>

        <div className="p-5 space-y-4 text-[13px]">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-sunken p-3 border border-border-default">
              <p className="text-text-secondary text-[11px] mb-1">Resulting time window</p>
              <p className="font-semibold text-text-primary">
                {new Date(combinedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {new Date(combinedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="bg-surface-sunken p-3 border border-border-default">
              <p className="text-text-secondary text-[11px] mb-1">Lead department</p>
              <div className="font-semibold text-text-primary">
                <DepartmentBadge dept={leadDept} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-text-secondary text-[11px] mb-1">Newly affected trains</p>
            {newlyAffectedTrains.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1 text-text-primary">
                {newlyAffectedTrains.map((t) => (
                  <li key={t!.id}>
                    <span className="font-medium">{t!.id}</span> {t!.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-primary font-medium italic">No additional trains affected</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border-default">
            <label className="block text-[11px] font-semibold text-text-primary uppercase tracking-wide mb-2">
              Type CONFIRM to execute
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border-default bg-surface-sunken text-text-primary text-[14px] outline-none focus:border-brand"
              placeholder="CONFIRM"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 bg-surface-sunken border-t border-border-default flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12.5px] font-medium text-text-primary hover:bg-surface border border-transparent transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={confirmText !== "CONFIRM"}
            onClick={onConfirm}
            className="px-4 py-2 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Confirm {actionName}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function ConflictsPage() {
  const { data, resolveConflict, refresh, optimizer, currentRunId } = useDashboardData();
  const { blocks, conflicts, serverConflicts, trains: trainPaths, proposals } = data;
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [previewAction, setPreviewAction] = useState<{
    conflict: ConflictRecord;
    action: "Merge" | "Sequence";
  } | null>(null);

  const handleRunDetection = async () => {
    setDetecting(true);
    setDetectMsg(null);
    try {
      const activeRunId = currentRunId || optimizer?._run_id || proposals[0]?.run_id;
      if (!activeRunId) {
        throw new Error("No active OptimizationRun found. Please run the Optimizer on the Plan page first.");
      }
      const results = await detectConflicts({ run_id: activeRunId });
      setDetectMsg({
        type: "success",
        text: `Conflict detection complete: ${results.length} server-side conflict(s) verified for run ${activeRunId.slice(0, 8)}...`,
      });
      refresh();
    } catch (err: unknown) {
      setDetectMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Conflict detection failed",
      });
    } finally {
      setDetecting(false);
    }
  };

  // Map server conflicts by ID for rich metadata
  const serverConflictMap = useMemo(
    () => new Map(serverConflicts.map((sc) => [sc.id, sc])),
    [serverConflicts],
  );

  const filtered = conflicts.filter((c) => {
    // Quick search
    if (
      search &&
      !c.id.toLowerCase().includes(search.toLowerCase()) &&
      !c.overlapDescription.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }

    const sc = serverConflictMap.get(c.id);
    const severity = sc ? sc.severity.toLowerCase() : "medium";
    if (severityFilter !== "All" && severity !== severityFilter.toLowerCase()) return false;

    // Dept filter
    const bA = blocks.find((b) => b.id === c.blockAId);
    const bB = blocks.find((b) => b.id === c.blockBId);
    if (deptFilter !== "All") {
      const matchesA = bA && bA.department === deptFilter;
      const matchesB = bB && bB.department === deptFilter;
      if (!matchesA && !matchesB) return false;
    }

    return true;
  });

  const unresolved = filtered
    .filter((c) => c.status === "Unresolved")
    .sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime());

  const resolved = filtered
    .filter((c) => c.status === "Resolved")
    .sort((a, b) => {
      const tA = a.resolution?.timestamp ? new Date(a.resolution.timestamp).getTime() : 0;
      const tB = b.resolution?.timestamp ? new Date(b.resolution.timestamp).getTime() : 0;
      return tB - tA;
    });

  return (
    <>
      <TopBar title="Conflict resolution" subtitle="Authoritative cross-department overlap detection and resolution" />

      {previewAction && (
        <PreviewModal
          conflict={previewAction.conflict}
          blocks={blocks}
          trainPaths={trainPaths}
          actionName={previewAction.action}
          onClose={() => setPreviewAction(null)}
          onConfirm={() => {
            resolveConflict(previewAction.conflict.id, previewAction.action === "Merge" ? "Merged" : "Sequenced");
            setPreviewAction(null);
          }}
        />
      )}

      <div className="flex-1 min-h-0 p-5 overflow-y-auto bg-canvas space-y-6">
        {detectMsg && (
          <div
            className={`px-4 py-2.5 text-[12px] font-medium flex items-center justify-between border ${
              detectMsg.type === "success"
                ? "bg-success/10 border-success/20 text-success"
                : "bg-critical/10 border-critical/20 text-critical"
            }`}
          >
            <div className="flex items-center gap-2">
              {detectMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{detectMsg.text}</span>
            </div>
            <button onClick={() => setDetectMsg(null)} className="text-text-secondary hover:text-text-primary cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-72">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by ID or description..." />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary rounded-sm cursor-pointer"
            >
              <option value="All">All Departments</option>
              <option value="Engg">ENGG</option>
              <option value="TRD">TRD</option>
              <option value="S&T">S&T</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary rounded-sm cursor-pointer"
            >
              <option value="All">All Severities</option>
              <option value="critical">Critical Severity</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>
          </div>

          <button
            onClick={handleRunDetection}
            disabled={detecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors rounded-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={detecting ? "animate-spin" : ""} />
            {detecting ? "Detecting conflicts…" : "Detect conflicts"}
          </button>
        </div>

        {/* Unresolved List */}
        <div>
          <h2 className="text-[14px] font-semibold text-text-primary mb-3">
            Unresolved conflicts ({unresolved.length})
          </h2>
          <div className="space-y-3">
            {unresolved.map((c) => {
              const bA = blocks.find((b) => b.id === c.blockAId);
              const bB = blocks.find((b) => b.id === c.blockBId);
              const sc = serverConflictMap.get(c.id);
              const severityTier = getConflictSeverityColor(sc ? sc.severity : "medium") as any;

              return (
                <div
                  key={c.id}
                  id={c.id}
                  className="bg-surface border border-border-default relative overflow-hidden flex flex-col group"
                >
                  <UrgencyBorder
                    tier={severityTier}
                    className="absolute left-0 top-0 bottom-0 pointer-events-none opacity-80 border-l-[4px]"
                  />

                  <div className="px-4 py-3 flex items-start gap-6 border-b border-border-default pl-6">
                    {/* Header/ID */}
                    <div className="w-28 shrink-0">
                      <div className="flex items-center gap-1.5 text-critical font-bold text-[13px] mb-1">
                        <AlertTriangle size={14} strokeWidth={2.5} />
                        {c.id}
                      </div>
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm ${
                          severityTier === "critical"
                            ? "bg-critical/10 text-critical"
                            : severityTier === "warning"
                              ? "bg-warning/10 text-warning"
                              : "bg-caution/10 text-caution"
                        }`}
                      >
                        {sc?.severity || "MEDIUM"}
                      </span>
                      {sc?.conflict_type && (
                        <p className="text-[10px] text-text-secondary mt-1 font-mono uppercase truncate">
                          {sc.conflict_type.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      {/* Block A */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {bA ? <DepartmentBadge dept={bA.department} /> : <span className="text-[11px] font-semibold text-brand">PROPOSAL</span>}
                          <span className="text-[12px] font-mono font-medium text-text-primary">
                            {c.blockAId || "Block A"}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-primary truncate">
                          {bA ? bA.description : `Proposal ${c.blockAId}`}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          {bA ? `Km ${bA.location.kmStart}-${bA.location.kmEnd} • ` : ""}
                          {formatTime(c.windowStart)}
                        </p>
                      </div>

                      {/* VS / Overlap */}
                      <div className="flex flex-col items-center justify-center px-4">
                        <div className="w-px h-4 bg-border-default mb-1" />
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest bg-canvas px-1">
                          VS
                        </span>
                        <div className="w-px h-4 bg-border-default mt-1" />
                        <p className="text-[11px] text-text-primary font-medium mt-1 text-center max-w-[140px] truncate">
                          {c.overlapDescription}
                        </p>
                      </div>

                      {/* Block B or Train */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {bB ? <DepartmentBadge dept={bB.department} /> : <span className="text-[11px] font-semibold text-warning">TRAIN / OPPOSING</span>}
                          <span className="text-[12px] font-mono font-medium text-text-primary">
                            {c.blockBId || "External Movement"}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-primary truncate">
                          {bB ? bB.description : `Conflicting train movement ${c.blockBId}`}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          {bB ? `Km ${bB.location.kmStart}-${bB.location.kmEnd} • ` : ""}
                          {formatTime(c.windowStart)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-2 bg-surface-sunken flex items-center justify-end gap-2 pl-6">
                    <Link
                      href={`/plan?focus=${c.id}`}
                      className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-border-default text-text-primary hover:bg-surface transition-colors bg-surface rounded-sm"
                    >
                      <Eye size={13} strokeWidth={2} /> View in chart
                    </Link>
                    <button
                      onClick={() => resolveConflict(c.id, "Escalated")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-border-default text-text-primary hover:bg-surface transition-colors bg-surface rounded-sm cursor-pointer"
                    >
                      <ArrowUpRight size={13} strokeWidth={2} /> Escalate
                    </button>
                    <button
                      onClick={() => setPreviewAction({ conflict: c, action: "Sequence" })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-border-default text-text-primary hover:bg-surface transition-colors bg-surface rounded-sm cursor-pointer"
                    >
                      <ArrowRightLeft size={13} strokeWidth={2} /> Sequence
                    </button>
                    <button
                      onClick={() => setPreviewAction({ conflict: c, action: "Merge" })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors rounded-sm cursor-pointer"
                    >
                      <Merge size={13} strokeWidth={2} /> Merge into combined block
                    </button>
                  </div>
                </div>
              );
            })}

            {unresolved.length === 0 && (
              <div className="bg-surface border border-border-default p-8 text-center text-text-secondary text-[13px]">
                No unresolved conflicts detected for the active schedule window.
              </div>
            )}
          </div>
        </div>

        {/* Resolved List */}
        {resolved.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[14px] font-semibold text-text-primary mb-3">
              Recently resolved ({resolved.length})
            </h2>
            <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
              {resolved.map((c) => (
                <div
                  key={c.id}
                  className="bg-surface border border-border-default px-4 py-3 flex items-center gap-4"
                >
                  <div className="w-24 text-[12px] font-mono font-medium text-text-primary line-through decoration-text-secondary/50">
                    {c.id}
                  </div>
                  <div className="flex-1 text-[12px] text-text-secondary truncate">
                    {c.blockAId} <span className="mx-1">vs</span> {c.blockBId} — {c.overlapDescription}
                  </div>
                  {c.resolution && (
                    <div className="text-[11px] text-text-primary font-medium text-right flex flex-col items-end">
                      <span>
                        {c.resolution.action} by {c.resolution.actor}
                      </span>
                      <span className="text-text-secondary font-normal">
                        {formatRelativeTime(c.resolution.timestamp)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
