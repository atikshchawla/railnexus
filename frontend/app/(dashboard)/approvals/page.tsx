"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout";
import { SearchBar, Pagination, ProvenanceBadge } from "@/components/shared";
import { mockBlockRequests } from "@/lib/mock-data";
import {
  Filter,
  ThumbsUp,
  ThumbsDown,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Eye,
  AlertTriangle,
} from "lucide-react";

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

type Horizon = "all" | "today" | "week" | "month";
const PAGE_SIZE = 10;

export default function ApprovalsPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [horizon, setHorizon] = useState<Horizon>("all");
  const [page, setPage] = useState(1);

  const filtered = mockBlockRequests.filter((r) => {
    if (deptFilter !== "All" && r.department !== deptFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map((r) => r.id)));
  };

  const selectedPending = paged.filter(
    (r) => selected.has(r.id) && r.status === "Under review"
  );

  return (
    <>
      <TopBar
        title="Approvals"
        subtitle={`${filtered.filter((r) => r.status === "Under review").length} pending review`}
      />
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-64">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          </div>

          {/* Horizon filter */}
          <div className="flex bg-surface-sunken border border-border-default">
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
              ] as [Horizon, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setHorizon(key); setPage(1); }}
                className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                  horizon === key
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
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
        </div>

        {/* Bulk-action bar (visible when ≥1 row selected) */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-brand/5 border border-brand/20">
            <span className="text-[12.5px] font-medium text-brand">
              {selected.size} selected
            </span>
            {selectedPending.length > 0 && (
              <>
                <button className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors">
                  <ThumbsUp size={12} strokeWidth={2} />
                  Batch approve ({selectedPending.length})
                </button>
                <button className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium border border-critical/30 text-critical hover:bg-critical/5 transition-colors">
                  <ThumbsDown size={12} strokeWidth={2} />
                  Batch reject
                </button>
              </>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-[11px] text-text-secondary hover:text-text-primary"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface border border-border-default overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left">
                <th className="px-3 py-2 w-8">
                  <button onClick={toggleAll}>
                    {selected.size === paged.length && paged.length > 0 ? (
                      <CheckSquare size={14} strokeWidth={1.75} />
                    ) : (
                      <Square size={14} strokeWidth={1.75} />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Block ID</th>
                <th className="px-3 py-2 font-medium">Dept</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Date / Time</th>
                <th className="px-3 py-2 font-medium">Urgency</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Conflict</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {paged.map((req) => (
                <tr
                  key={req.id}
                  className={`hover:bg-surface-sunken/50 transition-colors ${selected.has(req.id) ? "bg-brand/3" : ""}`}
                >
                  <td className="px-3 py-2">
                    <button onClick={() => toggleSelect(req.id)}>
                      {selected.has(req.id) ? (
                        <CheckSquare size={14} strokeWidth={1.75} className="text-brand" />
                      ) : (
                        <Square size={14} strokeWidth={1.75} />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${categoryStyle[req.category]}`}>
                      {req.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 num font-medium">{req.id}</td>
                  <td className="px-3 py-2 text-text-secondary">{req.department}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate">{req.description}</td>
                  <td className="px-3 py-2 num text-[12px]">{req.section}</td>
                  <td className="px-3 py-2 text-[12px] whitespace-nowrap">
                    <div>{req.scheduledDate}</div>
                    <div className="text-text-secondary">{req.scheduledTime}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[12px] ${urgencyStyle[req.urgency.level]}`}>
                      {req.urgency.deadline}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1.5 bg-surface-sunken overflow-hidden">
                        <div className="h-full bg-brand" style={{ width: `${req.confidence}%` }} />
                      </div>
                      <span className="num text-[11px]">{req.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {req.hasConflict ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-critical font-medium">
                        <AlertTriangle size={11} strokeWidth={2} />
                        Yes
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-secondary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-text-secondary">{req.status}</td>
                  <td className="px-3 py-2">
                    <ProvenanceBadge provenance={req.provenance} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {req.status === "Under review" ? (
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1 rounded hover:bg-surface-sunken" title="View in plan">
                          <Eye size={14} strokeWidth={1.75} className="text-text-secondary" />
                        </button>
                        <button className="p-1 rounded hover:bg-success/10" title="Approve">
                          <ThumbsUp size={14} strokeWidth={1.75} className="text-success" />
                        </button>
                        <button className="p-1 rounded hover:bg-brand/10" title="Adjust timing">
                          <SlidersHorizontal size={14} strokeWidth={1.75} className="text-brand" />
                        </button>
                        <button className="p-1 rounded hover:bg-critical/10" title="Reject">
                          <ThumbsDown size={14} strokeWidth={1.75} className="text-critical" />
                        </button>
                      </div>
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
