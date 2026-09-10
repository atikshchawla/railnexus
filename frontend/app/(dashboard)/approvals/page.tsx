"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout";
import { Pagination } from "@/components/shared";
import { useDashboardData } from "@/lib/dashboard-context";
import { isBatchEligible } from "@/lib/rules";
import {
  DepartmentBadge,
  UrgencyText,
  UrgencyBorder,
  ConflictIndicator,
  StatusPill,
  AcronymLegend,
  ConfidenceDisplay,
} from "@/components/shared";
import { Filter, CheckSquare, Settings2, XSquare, Eye, Layers } from "lucide-react";
import Link from "next/link";
import type { BlockRecord } from "@/lib/types";
import { optimizeRequests, updateRequestStatus, type OptimizerResponse, type OptimizedBlockResponse } from "@/lib/api";
import { AdjustModal } from "@/components/dashboard";

const PAGE_SIZE = 10;

type DisplayItem = 
  | { isGrouped: false; item: BlockRecord }
  | { isGrouped: true; id: string; optBlock: OptimizedBlockResponse; items: BlockRecord[] };

export default function ApprovalsPage() {
  const { data } = useDashboardData();
  const { blocks, syncedAt } = data;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("All");
  
  const [optimizerResponse, setOptimizerResponse] = useState<OptimizerResponse | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [adjustItem, setAdjustItem] = useState<DisplayItem | null>(null);

  const pendingApprovals = blocks.filter(b => b.status === "Under review" || b.status === "Submitted")
    .sort((a, b) => {
      const aVal = a.urgency.timeToBreachHours ?? Number.MAX_SAFE_INTEGER;
      const bVal = b.urgency.timeToBreachHours ?? Number.MAX_SAFE_INTEGER;
      return aVal - bVal;
    });

  const pendingIdsString = pendingApprovals.map(b => b.id).sort().join(",");

  useEffect(() => {
    if (pendingApprovals.length > 0) {
      setIsOptimizing(true);
      optimizeRequests(pendingApprovals.map(b => b.id))
        .then(res => setOptimizerResponse(res))
        .catch(err => console.error("Optimizer error:", err))
        .finally(() => setIsOptimizing(false));
    } else {
      setOptimizerResponse(null);
    }
  }, [pendingIdsString]); // Re-run when the exact set of pending IDs changes

  // Create unified display list
  let displayItems: DisplayItem[] = [];
  
  if (optimizerResponse) {
    optimizerResponse.selected_blocks.forEach((optBlock, i) => {
      if (optBlock.request_ids.length > 1) {
        const groupItems = optBlock.request_ids.map(id => pendingApprovals.find(b => b.id === id)).filter(Boolean) as BlockRecord[];
        displayItems.push({
          isGrouped: true,
          id: `SHADOW-${i}`,
          optBlock,
          items: groupItems
        });
      } else {
        const reqId = optBlock.request_ids[0];
        const baseReq = pendingApprovals.find(b => b.id === reqId);
        if (baseReq) displayItems.push({ isGrouped: false, item: baseReq });
      }
    });
    
    optimizerResponse.ungrouped_request_ids.forEach(reqId => {
       const baseReq = pendingApprovals.find(b => b.id === reqId);
       if (baseReq) displayItems.push({ isGrouped: false, item: baseReq });
    });
  } else {
    displayItems = pendingApprovals.map(b => ({ isGrouped: false, item: b }));
  }

  // Filter
  const filtered = displayItems.filter(di => {
    if (deptFilter === "All") return true;
    if (di.isGrouped) return di.items.some(i => i.department === deptFilter);
    return di.item.department === deptFilter;
  });
  
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i.isGrouped ? i.id : i.item.id)));
  };

  const selectedCount = selectedIds.size;
  
  // Action Handlers
  const handleAction = async (id: string, action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (action === "Approve Group") {
        const group = displayItems.find(di => di.id === id);
        if (group && group.isGrouped) {
          await Promise.all(group.items.map(item => updateRequestStatus(item.id, "approved")));
        }
      } else {
        await updateRequestStatus(id, "approved");
      }
      alert(`Audit Log: Successfully approved ${id}. Timestamp: ${new Date().toISOString()}`);
      // Refresh the page or let the 15s poll handle it? We can force a refresh by mutating state, but letting dashboard context handle it is fine.
    } catch (err) {
      alert(`Failed to approve ${id}: ${err}`);
    }
  };

  return (
    <>
      <TopBar
        title="Pending approvals"
        subtitle="Review and approve proposed block windows"
      />
      
      {selectedCount > 0 && (
        <div className="bg-surface-sunken border-b border-border-default px-5 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-text-primary">
              {selectedCount} selected 
            </span>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-[12.5px] font-medium border border-border-default text-text-primary bg-surface hover:bg-surface-sunken transition-colors">
              Reject ({selectedCount})
            </button>
            <button 
              className="px-4 py-2 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors"
            >
              Batch approve ({selectedCount})
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-canvas">
        <AcronymLegend />

        <div className="flex items-center justify-between">
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
              <option value="S&T">S&T</option>
            </select>
          </div>
          {isOptimizing && (
            <span className="text-[12px] text-brand font-medium flex items-center gap-2 animate-pulse">
              <Layers size={14} /> ML Optimizer grouping blocks...
            </span>
          )}
        </div>

        <div className="bg-surface border border-border-default overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px]">
                <th scope="col" className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedCount === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded-sm border-border-default text-brand focus:ring-brand"
                  />
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">ID</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Dept</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Schedule</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Urgency</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Confidence</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {paged.map((di, idx) => {
                if (di.isGrouped) {
                  const isSelected = selectedIds.has(di.id);
                  // Render Grouped Row
                  const startD = new Date();
                  startD.setHours(0, di.optBlock.scheduled_start_minute || 0, 0, 0);
                  const endD = new Date();
                  endD.setHours(0, di.optBlock.scheduled_end_minute || 0, 0, 0);
                  
                  return (
                    <tr key={di.id} className={`transition-colors relative group border-l-2 border-brand bg-brand/5`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox" checked={isSelected} onChange={() => toggleSelect(di.id)}
                          className="rounded-sm border-border-default text-brand focus:ring-brand"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[12px] flex items-center gap-1.5">
                        <Layers size={14} className="text-brand" /> {di.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                           {Array.from(new Set(di.items.map(i => i.department))).map(d => (
                             <DepartmentBadge key={d} dept={d} />
                           ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] text-text-primary">
                        <div className="font-semibold text-brand text-[12px] mb-0.5">Shadow Block: {di.items.length} requests grouped</div>
                        <div className="text-[11px] text-text-secondary truncate">
                          {di.items.map(i => i.id).join(", ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-text-primary font-medium">
                        {startD.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} – {endD.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-4 py-3">
                        <UrgencyText tier="warning" text="Optimized" />
                      </td>
                      <td className="px-4 py-3 text-[11px] text-text-secondary">
                        Saves {di.optBlock.possession_saving_minutes.toFixed(0)} min of possession time
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 flex-nowrap">
                          <button onClick={(e) => { e.stopPropagation(); setAdjustItem(di); }} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-brand text-brand hover:bg-brand/10 transition-colors bg-surface whitespace-nowrap text-[11.5px] font-medium">
                            <Settings2 size={13} strokeWidth={2} /> Adjust
                          </button>
                          <button onClick={(e) => handleAction(di.id, "Approve Group", e)} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand text-white hover:bg-brand-hover transition-colors whitespace-nowrap text-[11.5px] font-medium">
                            <CheckSquare size={13} strokeWidth={2} /> Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                } else {
                  // Render Single Row
                  const item = di.item;
                  const isSelected = selectedIds.has(item.id);
                  const eligible = isBatchEligible(item);
                  const breachText = item.urgency.timeToBreachHours === null ? "Routine" : `${Math.ceil(item.urgency.timeToBreachHours / 24)} days`;

                  return (
                    <tr key={item.id} className={`transition-colors relative group ${isSelected ? "bg-surface-sunken" : "hover:bg-surface-sunken/50"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center h-full relative">
                          <UrgencyBorder tier={item.urgency.tier} className="absolute left-0 w-full h-full -ml-4 pl-4 pointer-events-none opacity-80" />
                          <input
                            type="checkbox" checked={isSelected} disabled={!eligible}
                            onChange={() => toggleSelect(item.id)}
                            className={`rounded-sm border-border-default text-brand focus:ring-brand z-10 relative ${!eligible ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 num font-medium text-[12px]">
                        {item.id}
                        {!eligible && (
                          <div className="mt-1">
                            <ConflictIndicator conflictId={item.conflict?.conflictId} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><DepartmentBadge dept={item.department} /></td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-text-primary">
                        {item.description}
                        <div className="text-[11px] text-text-secondary mt-0.5">Km {item.location.kmStart} ({item.location.line})</div>
                      </td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-text-primary font-medium">
                        {new Date(item.scheduledWindow.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} – {new Date(item.scheduledWindow.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-4 py-3">
                        <UrgencyText tier={item.urgency.tier} text={breachText} />
                      </td>
                      <td className="px-4 py-3 max-w-[250px]">
                        {item.aiSuggestion ? (
                          <ConfidenceDisplay aiSuggestion={item.aiSuggestion} />
                        ) : (
                          <span className="text-[11px] text-text-secondary italic">Standalone (not grouped)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 flex-nowrap">
                          <button onClick={(e) => { e.stopPropagation(); setAdjustItem(di); }} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface whitespace-nowrap text-[11.5px] font-medium">
                            <Settings2 size={13} strokeWidth={2} /> Adjust
                          </button>
                          <button onClick={(e) => handleAction(item.id, "Approve", e)} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand text-white hover:bg-brand-hover transition-colors whitespace-nowrap text-[11.5px] font-medium">
                            <CheckSquare size={13} strokeWidth={2} /> Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
      
      {/* Adjust Modal */}
      {adjustItem && (
        <AdjustModal 
          displayItem={adjustItem} 
          onClose={() => setAdjustItem(null)} 
        />
      )}
    </>
  );
}
