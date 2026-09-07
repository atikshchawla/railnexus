"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout";
import { SearchBar, Pagination, ProvenanceBadge } from "@/components/shared";
import { mockBacklog } from "@/lib/mock-data";
import { Plus, AlertTriangle } from "lucide-react";
import type { BacklogItem } from "@/lib/types";

const categoryStyle: Record<string, string> = {
  IMR: "text-critical bg-critical/8",
  OBS: "text-warning bg-warning-bg",
  PM: "text-info bg-info/8",
};

const urgencyStyle: Record<string, string> = {
  critical: "text-critical font-semibold",
  high: "text-warning font-medium",
  medium: "text-text-primary",
  low: "text-text-secondary",
};

const PAGE_SIZE = 10;

export default function BacklogPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [page, setPage] = useState(1);

  const filtered = mockBacklog.filter((item) => {
    if (deptFilter !== "All" && item.department !== deptFilter) return false;
    if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.id.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <TopBar
        title="Maintenance backlog"
        subtitle="Auto-populated from TMS, SMMS, TDMS — manual entry is secondary"
      />
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
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
            className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            <option value="All">All categories</option>
            <option value="IMR">IMR</option>
            <option value="OBS">OBS</option>
            <option value="PM">PM</option>
          </select>
          <button className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors">
            <Plus size={13} strokeWidth={2} />
            Report a new defect
          </button>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border-default overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left">
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Dept</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Urgency</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Conflict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {paged.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-surface-sunken/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2">
                    <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${categoryStyle[item.category]}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-2 num font-medium">{item.id}</td>
                  <td className="px-4 py-2 text-text-secondary">{item.department}</td>
                  <td className="px-4 py-2 max-w-[250px] truncate">{item.description}</td>
                  <td className="px-4 py-2 num text-[12px]">{item.location}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[12px] ${urgencyStyle[item.urgency.level]}`}>
                      {item.urgency.deadline}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-text-secondary">{item.status}</td>
                  <td className="px-4 py-2">
                    <ProvenanceBadge provenance={item.provenance} />
                  </td>
                  <td className="px-4 py-2">
                    {item.hasConflict ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-critical font-medium">
                        <AlertTriangle size={11} strokeWidth={2} />
                        {item.conflictWith}
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              ))}
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
