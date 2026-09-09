"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout";
import { SearchBar, Pagination } from "@/components/shared";
import { useDashboardData } from "@/lib/dashboard-context";
import { Plus, ArrowRight, Square, Circle, Triangle } from "lucide-react";
import type { Category, Department, BlockRecord } from "@/lib/types";
import {
  DepartmentBadge,
  UrgencyText,
  UrgencyBorder,
  ConflictIndicator,
  StatusPill,
  AcronymLegend,
} from "@/components/shared";

// ─── Constants ────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const DEPT_HUES: Record<Department, string> = {
  Engg: "text-amber-700",
  TRD: "text-blue-700",
  "S&T": "text-green-700",
};

// ─── Helpers ─────────────────────────────────────────────────────────

function CategoryIcon({ category, dept }: { category: Category; dept: Department }) {
  const colorClass = DEPT_HUES[dept];
  
  switch (category) {
    case "IMR": return <Square size={16} strokeWidth={2.5} className={colorClass} />;
    case "OBS": return <Circle size={16} strokeWidth={2.5} className={colorClass} />;
    case "PM":  return <Triangle size={16} strokeWidth={2.5} className={colorClass} />;
  }
}

export default function BacklogPage() {
  const { data } = useDashboardData();
  const { blocks } = data;
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [promotedBlocks, setPromotedBlocks] = useState<Set<string>>(new Set());

  const filtered = blocks.filter((item) => {
    if (deptFilter !== "All" && item.department !== deptFilter) return false;
    if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.id.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePromote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(promotedBlocks);
    next.add(id);
    setPromotedBlocks(next);
  };

  return (
    <>
      <TopBar
        title="Maintenance backlog"
        subtitle="Auto-populated from TMS, SMMS, TDMS — manual entry is secondary"
      />
      <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-canvas">
        
        <AcronymLegend />

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            aria-label="Filter by department"
            className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            <option value="All">All departments</option>
            <option value="Engg">Engg</option>
            <option value="TRD">TRD</option>
            <option value="S&T">S&T</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            aria-label="Filter by category"
            className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            <option value="All">All categories</option>
            <option value="IMR">IMR</option>
            <option value="OBS">OBS</option>
            <option value="PM">PM</option>
          </select>
          <button className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface">
            <Plus size={13} strokeWidth={2} />
            Report a new defect
          </button>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border-default overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px]">
                <th scope="col" className="px-4 py-2.5 font-semibold">Category</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">ID</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Dept</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Location</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Time-to-breach</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Source</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Conflict</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {paged.map((item) => {
                const isAging = item.status === "Under review" && (item.urgency.tier === "critical" || item.urgency.tier === "warning");
                const breachText = item.urgency.timeToBreachHours === null 
                  ? "Routine" 
                  : `${Math.ceil(item.urgency.timeToBreachHours / 24)} days to SLA breach`;
                
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-sunken/50 transition-colors group"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center h-full">
                        <UrgencyBorder tier={item.urgency.tier} className={`absolute left-0 w-full h-full -ml-4 pl-4 pointer-events-none opacity-0 ${isAging ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity`}>
                          <div className="flex items-center gap-2 mt-1">
                            <CategoryIcon category={item.category} dept={item.department} />
                            <span className="text-[11px] font-semibold text-text-primary tracking-wide">{item.category}</span>
                            {isAging && (
                              <span className="ml-1 inline-block px-1 bg-critical/10 text-critical text-[9px] font-bold uppercase rounded-sm border border-critical/20">Aging</span>
                            )}
                          </div>
                        </UrgencyBorder>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 num font-medium text-[12px]">{item.id}</td>
                    <td className="px-4 py-2.5"><DepartmentBadge dept={item.department} /></td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-text-primary">{item.description}</td>
                    <td className="px-4 py-2.5 text-[12px] whitespace-nowrap text-text-secondary">Km {item.location.kmStart} ({item.location.line})</td>
                    <td className="px-4 py-2.5">
                      <UrgencyText tier={item.urgency.tier} text={breachText} />
                    </td>
                    <td className="px-4 py-2.5"><StatusPill status={item.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold">{item.source.system}</span>
                        <span className="text-[10px] text-text-secondary">{item.source.lastUpdated}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.conflict ? (
                        <Link href={`/conflicts#${item.conflict.conflictId}`} className="hover:underline">
                          <ConflictIndicator conflictId={item.conflict.conflictId} />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {promotedBlocks.has(item.id) || item.status === "Approved" || item.status === "Active" ? (
                        <Link href={`/plan?focus=${item.id}`} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand hover:underline whitespace-nowrap">
                          Proposed as {item.id} <ArrowRight size={12} />
                        </Link>
                      ) : (
                        <button
                          onClick={(e) => handlePromote(item.id, e)}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-[11.5px] font-medium bg-surface-sunken border border-border-default text-text-primary hover:bg-surface-sunken/80 transition-colors whitespace-nowrap"
                        >
                          Promote to proposal
                        </button>
                      )}
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
