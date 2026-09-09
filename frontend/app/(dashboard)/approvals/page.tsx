"use client";

import { useState } from "react";
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
import { Filter, CheckSquare, Settings2, XSquare, Eye } from "lucide-react";
import Link from "next/link";
import type { BlockRecord } from "@/lib/types";

const PAGE_SIZE = 10;

export default function ApprovalsPage() {
  const { data } = useDashboardData();
  const { blocks } = data;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("All");

  const pendingApprovals = blocks.filter(b => b.status === "Under review" || b.status === "Submitted")
    .sort((a, b) => {
      // Sort by urgency
      const aVal = a.urgency.timeToBreachHours ?? Number.MAX_SAFE_INTEGER;
      const bVal = b.urgency.timeToBreachHours ?? Number.MAX_SAFE_INTEGER;
      return aVal - bVal;
    });

  const filtered = pendingApprovals.filter(b => deptFilter === "All" || b.department === deptFilter);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i.id)));
  };

  const selectedCount = selectedIds.size;
  
  // Calculate eligible count from selection
  let eligibleCount = 0;
  let ineligibleCount = 0;
  selectedIds.forEach(id => {
    const item = pendingApprovals.find(b => b.id === id);
    if (item && isBatchEligible(item)) {
      eligibleCount++;
    } else {
      ineligibleCount++;
    }
  });

  const handleAction = (id: string, action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    alert(`Audit Log: ${action} on ${id}. Timestamp: ${new Date().toISOString()}`);
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
              {ineligibleCount > 0 && (
                <span className="text-text-secondary ml-1 font-normal">
                  — {eligibleCount} eligible for batch approval ({ineligibleCount} has an unresolved conflict)
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-[12.5px] font-medium border border-border-default text-text-primary bg-surface hover:bg-surface-sunken transition-colors">
              Reject ({selectedCount})
            </button>
            <button 
              disabled={eligibleCount === 0}
              className="px-4 py-2 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Batch approve ({eligibleCount})
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
              {paged.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const eligible = isBatchEligible(item);
                const breachText = item.urgency.timeToBreachHours === null 
                  ? "Routine" 
                  : `${Math.ceil(item.urgency.timeToBreachHours / 24)} days`;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors relative group ${isSelected ? "bg-surface-sunken" : "hover:bg-surface-sunken/50"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center h-full relative">
                        <UrgencyBorder tier={item.urgency.tier} className="absolute left-0 w-full h-full -ml-4 pl-4 pointer-events-none opacity-80" />
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!eligible}
                          title={!eligible ? "Has unresolved conflict — resolve in Conflicts before batch action." : undefined}
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
                        <span className="text-[11px] text-text-secondary italic">Manual submission</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 flex-nowrap">
                        <Link href={`/plan?focus=${item.id}`} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface whitespace-nowrap text-[11.5px] font-medium">
                          <Eye size={13} strokeWidth={2} /> View
                        </Link>
                        <button onClick={(e) => handleAction(item.id, "Adjust", e)} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface whitespace-nowrap text-[11.5px] font-medium">
                          <Settings2 size={13} strokeWidth={2} /> Adjust
                        </button>
                        <button onClick={(e) => handleAction(item.id, "Reject", e)} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border-default text-critical hover:bg-critical/5 transition-colors bg-surface whitespace-nowrap text-[11.5px] font-medium">
                          <XSquare size={13} strokeWidth={2} /> Reject
                        </button>
                        <button onClick={(e) => handleAction(item.id, "Approve", e)} className="touch-target inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand text-white hover:bg-brand-hover transition-colors whitespace-nowrap text-[11.5px] font-medium">
                          <CheckSquare size={13} strokeWidth={2} /> Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                );
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
    </>
  );
}
