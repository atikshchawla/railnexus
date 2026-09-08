"use client";

import { useState } from "react";
import {
  Filter,
  ThumbsUp,
  ThumbsDown,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Eye,
} from "lucide-react";
import type { BlockRequest } from "@/lib/types";

interface ApprovalsTableProps {
  requests: BlockRequest[];
}

const priorityStyle: Record<string, string> = {
  IMR: "badge-imr",
  OBS: "badge-obs",
  PM: "badge-pm",
  Routine: "text-text-secondary bg-surface-sunken",
};

const statusStyle: Record<string, string> = {
  Pending: "text-warning",
  Approved: "text-success",
  Rejected: "text-critical",
};

export default function ApprovalsTable({ requests }: ApprovalsTableProps) {
  const [filter, setFilter] = useState<"Under review" | "Approved" | "Rejected">("Under review");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = requests.filter((req) => req.status === filter);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };
  
  const allSelected = selected.size === filtered.length && filtered.length > 0;

  return (
    <div className="bg-surface border border-border-default h-full flex flex-col">
      {/* Header controls */}
      <div className="px-4 py-3 border-b border-border-default flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Filter
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as "Under review" | "Approved" | "Rejected");
                setSelected(new Set()); // reset selection on filter change
              }}
              className="pl-8 pr-8 py-1.5 text-[13px] border border-border-default bg-surface text-text-primary appearance-none cursor-pointer"
            >
              <option value="Under review">Pending Approvals</option>
              <option value="Approved">Recently Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <span className="text-[12px] text-text-secondary">
            {filtered.length} requests
          </span>
        </div>

        {selected.size > 0 && filter === "Under review" && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
            <span className="text-[12px] text-text-secondary">
              {selected.size} selected
            </span>
            <button className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors">
              <ThumbsUp size={12} strokeWidth={2} />
              Batch approve
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-sunken text-text-secondary text-left">
            <th scope="col" className="px-4 py-2 w-8">
              <button aria-label={allSelected ? "Deselect all blocks" : "Select all blocks"} onClick={toggleAll} className="flex items-center">
                {selected.size === filtered.length && filtered.length > 0 ? (
                  <CheckSquare size={14} strokeWidth={1.75} />
                ) : (
                  <Square size={14} strokeWidth={1.75} />
                )}
              </button>
            </th>
            <th scope="col" className="px-4 py-2 font-medium">Priority</th>
            <th scope="col" className="px-4 py-2 font-medium">Block ID</th>
            <th scope="col" className="px-4 py-2 font-medium">Dept</th>
            <th scope="col" className="px-4 py-2 font-medium">Description</th>
            <th scope="col" className="px-4 py-2 font-medium">Section</th>
            <th scope="col" className="px-4 py-2 font-medium">Date / Time</th>
            <th scope="col" className="px-4 py-2 font-medium">Duration</th>
            <th scope="col" className="px-4 py-2 font-medium">Confidence</th>
            <th scope="col" className="px-4 py-2 font-medium">Shadow</th>
            <th scope="col" className="px-4 py-2 font-medium">Status</th>
            <th scope="col" className="px-4 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {filtered.map((req) => (
            <tr
              key={req.id}
              className={`hover:bg-surface-sunken/50 transition-colors ${
                selected.has(req.id) ? "bg-brand/3" : ""
              }`}
            >
              <td className="px-4 py-2">
                <button
                  aria-label={`Select block ${req.id}`}
                  onClick={() => toggleSelect(req.id)}
                  className="flex items-center"
                >
                  {selected.has(req.id) ? (
                    <CheckSquare
                      size={14}
                      strokeWidth={1.75}
                      className="text-brand"
                    />
                  ) : (
                    <Square size={14} strokeWidth={1.75} />
                  )}
                </button>
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${priorityStyle[req.category]}`}
                >
                  {req.category}
                </span>
              </td>
              <td className="px-4 py-2 num font-medium">{req.id}</td>
              <td className="px-4 py-2 text-text-secondary">
                {req.department}
              </td>
              <td className="px-4 py-2 max-w-[220px] truncate">
                {req.description}
              </td>
              <td className="px-4 py-2 num text-[12px]">{req.section}</td>
              <td className="px-4 py-2 text-[12px] whitespace-nowrap">
                <div>{req.scheduledDate}</div>
                <div className="text-text-secondary">{req.scheduledTime}</div>
              </td>
              <td className="px-4 py-2 num">{req.duration}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1.5 bg-surface-sunken overflow-hidden">
                    <div
                      className="h-full bg-brand"
                      style={{ width: `${req.confidence}%` }}
                    />
                  </div>
                  <span className="num text-[11px]">{req.confidence}%</span>
                </div>
              </td>
              <td className="px-4 py-2 text-[12px] text-text-secondary">
                {req.shadow || "—"}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`text-[12px] font-medium ${statusStyle[req.status]}`}
                >
                  {req.status}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                {req.status === "Under review" ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-1 rounded hover:bg-surface-sunken transition-colors"
                      title="View in twin"
                      aria-label={`View block ${req.id} in twin`}
                    >
                      <Eye
                        size={14}
                        strokeWidth={1.75}
                        className="text-text-secondary"
                      />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-success/10 transition-colors"
                      title="Approve"
                      aria-label={`Approve block ${req.id}`}
                    >
                      <ThumbsUp
                        size={14}
                        strokeWidth={1.75}
                        className="text-success"
                      />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-brand/10 transition-colors"
                      title="Adjust timing"
                      aria-label={`Adjust timing for block ${req.id}`}
                    >
                      <SlidersHorizontal
                        size={14}
                        strokeWidth={1.75}
                        className="text-brand"
                      />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-critical/10 transition-colors"
                      title="Reject"
                      aria-label={`Reject block ${req.id}`}
                    >
                      <ThumbsDown
                        size={14}
                        strokeWidth={1.75}
                        className="text-critical"
                      />
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
    </div>
  );
}
