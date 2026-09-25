"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout";
import { useDashboardData } from "@/lib/dashboard-context";
import { isBatchEligible } from "@/lib/rules";
import {
  DepartmentBadge,
  UrgencyText,
  UrgencyBorder,
  ConflictIndicator,
  AcronymLegend,
  ConfidenceDisplay,
} from "@/components/shared";
import { URGENCY_COLORS } from "@/components/shared/DesignTokens";
import {
  Filter, CheckSquare, Settings2, Layers, ChevronDown, ChevronRight,
  Unlink, RefreshCw, AlertTriangle, Info,
} from "lucide-react";
import type { BlockRecord } from "@/lib/types";
import type { OptimizedBlockResponse, OperatorOverride } from "@/lib/api";
import { updateRequestStatus } from "@/lib/api";
import { AdjustModal } from "@/components/dashboard";

// ── Types ─────────────────────────────────────────────────────────────

export type DisplayItem =
  | { isGrouped: false; item: BlockRecord }
  | {
      isGrouped: true;
      id: string;
      optBlock: OptimizedBlockResponse;
      items: BlockRecord[];
      override?: OperatorOverride;
    };

// ── Helpers ───────────────────────────────────────────────────────────

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ── Sub-component: expanded rows for a shadow block ───────────────────

function ShadowGroupRows({
  di,
  onAdjust,
  onDissolve,
  onApproveAll,
  onCollapse,
}: {
  di: Extract<DisplayItem, { isGrouped: true }>;
  onAdjust: () => void;
  onDissolve: () => void;
  onApproveAll: (e: React.MouseEvent) => void;
  onCollapse: () => void;
}) {
  const override = di.override;
  const startMinute = override?.start_minute ?? di.optBlock.scheduled_start_minute ?? 0;
  const endMinute = override?.end_minute ?? di.optBlock.scheduled_end_minute ?? 0;
  const saving = di.optBlock.possession_saving_minutes;

  return (
    <>
      {/* Group header row — click anywhere to collapse */}
      <tr
        className="bg-brand/5 cursor-pointer hover:bg-brand/10 transition-colors"
        onClick={onCollapse}
      >
        <td className="px-3 py-2.5 border-l-[3px] border-brand w-10">
          <ChevronDown size={14} className="text-brand" />
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-brand">{di.id}</span>
            <span className="text-[10px] uppercase tracking-wide bg-brand/10 text-brand px-1.5 py-0.5 rounded-sm font-semibold">
              Shadow Block
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set(di.items.map((i) => i.department))).map((d) => (
              <DepartmentBadge key={d} dept={d} />
            ))}
          </div>
        </td>
        {/* Description col — shows the grouping rationale */}
        <td className="px-3 py-2.5 text-[11px] text-text-secondary">
          {di.items.length} requests grouped &middot; saves{" "}
          <span className="font-medium text-positive">{saving.toFixed(0)} min</span> possession
        </td>
        {/* Schedule col */}
        <td className="px-3 py-2.5 text-[12px] font-medium text-text-primary whitespace-nowrap">
          {override?.start_minute != null ? (
            <span className="text-warning">
              {formatMinutes(startMinute)} – {formatMinutes(endMinute)}
              <span className="text-[10px] ml-1">(adjusted)</span>
            </span>
          ) : (
            `${formatMinutes(startMinute)} – ${formatMinutes(endMinute)}`
          )}
        </td>
        <td className="px-3 py-2.5">
          <UrgencyText tier="warning" text="Optimized" />
        </td>
        <td className="px-3 py-2.5 text-[11px] text-text-secondary">
          Saves {saving.toFixed(0)} min possession
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
            <button
              onClick={(e) => { e.stopPropagation(); onDissolve(); }}
              title="Break group — approve each request individually"
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] border border-border-default text-text-secondary hover:text-critical hover:border-critical hover:bg-critical/5 transition-colors whitespace-nowrap"
            >
              <Unlink size={11} strokeWidth={2} /> Dissolve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAdjust(); }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] border border-brand text-brand hover:bg-brand/10 transition-colors bg-surface whitespace-nowrap"
            >
              <Settings2 size={11} strokeWidth={2} /> Adjust
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onApproveAll(e); }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] bg-brand text-white hover:bg-brand-hover transition-colors whitespace-nowrap"
            >
              <CheckSquare size={11} strokeWidth={2} /> Approve all
            </button>
          </div>
        </td>
      </tr>

      {/* Constituent request sub-rows */}
      {di.items.map((item, idx) => {
        const breachText =
          item.urgency.timeToBreachHours === null
            ? "Routine"
            : `${Math.ceil(item.urgency.timeToBreachHours / 24)} days`;
        const isLast = idx === di.items.length - 1;

        return (
          <tr
            key={item.id}
            className={`bg-brand/[0.02] text-[12px] ${isLast ? "border-b border-b-border-default" : ""}`}
          >
            <td className="py-2 text-center border-l-[3px] border-brand/30">
              <span className="text-[10px] text-text-secondary font-mono">#{idx + 1}</span>
            </td>
            <td className="px-3 py-2">
              <span className="font-mono text-[11px] font-medium text-text-primary">{item.id}</span>
              {item.conflict && item.conflict.status === "Unresolved" && (
                <div className="mt-0.5">
                  <ConflictIndicator conflictId={item.conflict.conflictId} />
                </div>
              )}
            </td>
            <td className="px-3 py-2">
              <DepartmentBadge dept={item.department} />
            </td>
            <td className="px-3 py-2 overflow-hidden text-text-primary">
              <p className="truncate">{item.description}</p>
              <p className="text-[10px] text-text-secondary">
                Km {item.location.kmStart} ({item.location.line})
              </p>
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-text-secondary">
              {new Date(item.scheduledWindow.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              –{" "}
              {new Date(item.scheduledWindow.end).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </td>
            <td className="px-3 py-2">
              <UrgencyText tier={item.urgency.tier} text={breachText} />
            </td>
            <td className="px-3 py-2 text-[11px] text-text-secondary">
              {item.aiSuggestion ? (
                <span>{item.aiSuggestion.confidence}% confident</span>
              ) : (
                <span className="italic">No prediction</span>
              )}
            </td>
            <td className="px-3 py-2" />
          </tr>
        );
      })}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { data, optimizer, optimizerLoading, optimizerError, rerunOptimizer, saveOverrides } =
    useDashboardData();
  const { blocks } = data;

  const [deptFilter, setDeptFilter] = useState("All");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dissolvedGroups, setDissolvedGroups] = useState<Set<string>>(new Set());
  const [adjustItem, setAdjustItem] = useState<DisplayItem | null>(null);

  const pendingApprovals = useMemo(
    () =>
      blocks
        .filter((b) => b.status === "Under review" || b.status === "Submitted")
        .sort((a, b) => {
          const aVal = a.urgency.timeToBreachHours ?? Number.MAX_SAFE_INTEGER;
          const bVal = b.urgency.timeToBreachHours ?? Number.MAX_SAFE_INTEGER;
          return aVal - bVal;
        }),
    [blocks],
  );

  // Build display list from optimizer result
  const displayItems: DisplayItem[] = useMemo(() => {
    if (!optimizer) return pendingApprovals.map((b) => ({ isGrouped: false, item: b }));

    const overrides = optimizer._operator_overrides ?? {};
    const items: DisplayItem[] = [];
    const addedIds = new Set<string>();

    optimizer.selected_blocks.forEach((optBlock, i) => {
      const groupId = `SHADOW-${i}`;
      const groupItems = optBlock.request_ids
        .map((id) => pendingApprovals.find((b) => b.id === id))
        .filter(Boolean) as BlockRecord[];

      groupItems.forEach((b) => addedIds.add(b.id));

      if (optBlock.request_ids.length > 1 && !dissolvedGroups.has(groupId)) {
        items.push({
          isGrouped: true,
          id: groupId,
          optBlock,
          items: groupItems,
          override: overrides[groupId],
        });
      } else {
        // Dissolved or single-item group — show as individual rows
        groupItems.forEach((item) => items.push({ isGrouped: false, item }));
      }
    });

    // Ungrouped requests not in any selected block
    optimizer.ungrouped_request_ids.forEach((reqId) => {
      const b = pendingApprovals.find((b) => b.id === reqId);
      if (b && !addedIds.has(b.id)) items.push({ isGrouped: false, item: b });
    });

    // Skipped requests (no ML features)
    (optimizer.skipped_request_ids ?? []).forEach((reqId) => {
      const b = pendingApprovals.find((b) => b.id === reqId);
      if (b && !addedIds.has(b.id)) items.push({ isGrouped: false, item: b });
    });

    return items;
  }, [optimizer, pendingApprovals, dissolvedGroups]);

  const filtered = useMemo(
    () =>
      displayItems.filter((di) => {
        if (deptFilter === "All") return true;
        if (di.isGrouped) return di.items.some((i) => i.department === deptFilter);
        return di.item.department === deptFilter;
      }),
    [displayItems, deptFilter],
  );

  const toggleExpand = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDissolve = async (groupId: string) => {
    setDissolvedGroups((prev) => new Set(prev).add(groupId));
    await saveOverrides({ [groupId]: { dissolved: true } });
  };

  const handleApproveAll = async (di: Extract<DisplayItem, { isGrouped: true }>, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await Promise.all(di.items.map((item) => updateRequestStatus(item.id, "approved")));
    } catch (err) {
      alert(`Failed to approve group: ${err}`);
    }
  };

  const handleApproveSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateRequestStatus(id, "approved");
    } catch (err) {
      alert(`Failed to approve ${id}: ${err}`);
    }
  };

  const groupCount = filtered.filter((di) => di.isGrouped).length;
  const totalSaving = optimizer?.selected_blocks
    .filter((_, i) => !dissolvedGroups.has(`SHADOW-${i}`))
    .reduce((acc, b) => acc + b.possession_saving_minutes, 0) ?? 0;

  return (
    <>
      <TopBar
        title="Pending approvals"
        subtitle="Review and approve proposed block windows"
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-canvas">
        {/* Summary banner */}
        {optimizer && (
          <div className="shrink-0 px-5 py-2 bg-surface border-b border-border-default flex items-center gap-6 text-[12px]">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Layers size={13} className="text-brand" />
              <span>
                <strong className="text-text-primary">{groupCount}</strong> shadow block
                {groupCount !== 1 ? "s" : ""}
              </span>
            </span>
            <span className="text-text-secondary">
              Combined saving:{" "}
              <strong className="text-positive">{totalSaving.toFixed(0)} min</strong> possession
              time
            </span>
            {optimizer._cache_id && (
              <span className="text-text-secondary flex items-center gap-1">
                <Info size={11} /> Served from cache
              </span>
            )}
            <button
              onClick={rerunOptimizer}
              disabled={optimizerLoading}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-[11px] border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={optimizerLoading ? "animate-spin" : ""} />
              Re-optimize
            </button>
          </div>
        )}

        {/* Optimizer loading / error states */}
        {optimizerLoading && !optimizer && (
          <div className="shrink-0 px-5 py-2 bg-brand/5 border-b border-brand/20 flex items-center gap-2 text-[12px] text-brand">
            <Layers size={13} className="animate-pulse" />
            ML Optimizer grouping blocks… (checking cache first)
          </div>
        )}
        {optimizerError && (
          <div className="shrink-0 px-5 py-1.5 bg-critical/5 border-b border-critical/20 flex items-center gap-2 text-[12px] text-critical">
            <AlertTriangle size={13} /> Optimizer error: {optimizerError}
          </div>
        )}

        <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4">
          <AcronymLegend />

          <div className="flex items-center gap-2 text-[13px]">
            <Filter size={14} className="text-text-secondary" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-transparent border-none text-text-primary font-medium focus:ring-0 cursor-pointer"
            >
              <option value="All">All Departments</option>
              <option value="Engg">Engineering</option>
              <option value="TRD">TRD</option>
              <option value="S&T">S&amp;T</option>
            </select>
          </div>

          <div className="bg-surface border border-border-default overflow-x-auto">
            <table className="w-full text-[13px] table-fixed min-w-[1100px]">
              <colgroup>
                <col className="w-8" />         {/* expand icon */}
                <col className="w-[160px]" />   {/* ID */}
                <col className="w-[100px]" />   {/* Dept */}
                <col />                         {/* Description — fills remaining */}
                <col className="w-[160px]" />   {/* Schedule */}
                <col className="w-[100px]" />   {/* Urgency */}
                <col className="w-[170px]" />   {/* Confidence */}
                <col className="w-[240px]" />   {/* Actions */}
              </colgroup>
              <thead>
                <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px]">
                  <th scope="col" className="px-3 py-2.5" />
                  <th scope="col" className="px-3 py-2.5 font-semibold">ID</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Dept</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Description</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Schedule</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Urgency</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Confidence</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filtered.map((di) => {
                  if (di.isGrouped) {
                    const isExpanded = expandedGroups.has(di.id);

                    return isExpanded ? (
                      <ShadowGroupRows
                        key={di.id}
                        di={di}
                        onAdjust={() => setAdjustItem(di)}
                        onDissolve={() => handleDissolve(di.id)}
                        onApproveAll={(e) => handleApproveAll(di, e)}
                        onCollapse={() => toggleExpand(di.id)}
                      />
                    ) : (
                      // ── Collapsed shadow block row ─────────────────
                      <tr
                        key={di.id}
                        className="cursor-pointer bg-brand/5 hover:bg-brand/10 transition-colors"
                        onClick={() => toggleExpand(di.id)}
                      >
                        <td className="px-3 py-3 border-l-[3px] border-brand">
                          <ChevronRight size={14} className="text-brand" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-semibold text-brand">{di.id}</span>
                            <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-sm font-semibold uppercase">
                              Shadow Block
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set(di.items.map((i) => i.department))).map((d) => (
                              <DepartmentBadge key={d} dept={d} />
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 overflow-hidden text-[11px] text-text-secondary">
                          <p className="truncate">
                            <span className="font-medium text-text-primary">{di.items.length} requests combined:</span>{" "}
                            {di.items.map((i) => i.description).join(" • ")}
                          </p>
                          <p className="truncate mt-0.5 text-brand font-medium">
                            Click to expand and view individual items
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[12px] font-medium text-text-primary whitespace-nowrap">
                          {formatMinutes(di.optBlock.scheduled_start_minute ?? 0)} –{" "}
                          {formatMinutes(di.optBlock.scheduled_end_minute ?? 0)}
                        </td>
                        <td className="px-3 py-3">
                          <UrgencyText tier="warning" text="Optimized" />
                        </td>
                        <td className="px-3 py-3 text-[11px] text-positive font-medium">
                          Saves {di.optBlock.possession_saving_minutes.toFixed(0)} min
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setAdjustItem(di); }}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] border border-brand text-brand hover:bg-brand/10 bg-transparent transition-colors"
                            >
                              <Settings2 size={11} /> Adjust
                            </button>
                            <button
                              onClick={(e) => handleApproveAll(di, e)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] bg-brand text-white hover:bg-brand-hover transition-colors"
                            >
                              <CheckSquare size={11} /> Approve all
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // ── Single (ungrouped) request row ─────────────────
                  const item = di.item;
                  const eligible = isBatchEligible(item);
                  const breachText =
                    item.urgency.timeToBreachHours === null
                      ? "Routine"
                      : `${Math.ceil(item.urgency.timeToBreachHours / 24)} days`;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-sunken/50 transition-colors relative group"
                    >
                      <td 
                        className="px-3 py-3 border-l-[3px]"
                        style={{ borderLeftColor: URGENCY_COLORS[item.urgency.tier] }}
                      >
                      </td>
                      <td className="px-3 py-3 num font-medium text-[12px]">
                        {item.id}
                        {!eligible && (
                          <div className="mt-1">
                            <ConflictIndicator conflictId={item.conflict?.conflictId} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3"><DepartmentBadge dept={item.department} /></td>
                      <td className="px-3 py-3 max-w-[200px] text-text-primary">
                        <p className="truncate">{item.description}</p>
                        <p className="text-[11px] text-text-secondary mt-0.5">
                          Km {item.location.kmStart} ({item.location.line})
                        </p>
                      </td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap text-text-primary font-medium">
                        {new Date(item.scheduledWindow.start).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        –{" "}
                        {new Date(item.scheduledWindow.end).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <UrgencyText tier={item.urgency.tier} text={breachText} />
                      </td>
                      <td className="px-3 py-3 max-w-[250px]">
                        {item.aiSuggestion ? (
                          <ConfidenceDisplay aiSuggestion={item.aiSuggestion} />
                        ) : (
                          <span className="text-[11px] text-text-secondary italic">
                            Standalone — no ML prediction
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); setAdjustItem(di); }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] border border-border-default text-text-primary hover:bg-surface-sunken bg-surface transition-colors"
                          >
                            <Settings2 size={11} /> Adjust
                          </button>
                          <button
                            onClick={(e) => handleApproveSingle(item.id, e)}
                            disabled={!eligible}
                            title={!eligible ? "Resolve conflict first" : "Approve"}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckSquare size={11} /> Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-text-secondary">
                      No pending approvals{deptFilter !== "All" ? ` for ${deptFilter}` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-4 py-2 text-[11px] text-text-secondary border-t border-border-default">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} pending
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustItem && (
        <AdjustModal
          displayItem={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSave={async (groupId, override) => {
            await saveOverrides({ [groupId]: override });
            setAdjustItem(null);
          }}
        />
      )}
    </>
  );
}
