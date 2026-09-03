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
import type { BlockRequest } from "@/lib/mock-approvals";

interface ApprovalsTableProps {
  requests: BlockRequest[];
}

const priorityStyle: Record<string, string> = {
  IMR: "text-critical bg-critical/8",
  OBS: "text-warning bg-warning-bg",
  PM: "text-info bg-info/8",
  Routine: "text-text-secondary bg-surface-sunken",
};

const statusStyle: Record<string, string> = {
  Pending: "text-warning",
  Approved: "text-success",
  Rejected: "text-critical",
  Active: "text-info",
  Completed: "text-text-secondary",
};

export default function ApprovalsTable({ requests }: ApprovalsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");

  const filtered = requests.filter((r) => {
    if (deptFilter !== "All" && r.department !== deptFilter) return false;
    if (priorityFilter !== "All" && r.priority !== priorityFilter) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };

  const pendingSelected = filtered.filter(
    (r) => selected.has(r.id) && r.status === "Pending"
  );

  return (
    <div className="bg-surface border border-border-default overflow-hidden">
      {/* Toolbar: filters + batch actions */}
      <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-3 flex-wrap">
        <Filter size={14} strokeWidth={1.75} className="text-text-secondary" />

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-[12.5px] px-2 py-1 border border-border-default bg-surface text-text-primary"
        >
          <option value="All">All departments</option>
          <option value="Engg">Engg</option>
          <option value="TRD">TRD</option>
          <option value="S&T">S&T</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-[12.5px] px-2 py-1 border border-border-default bg-surface text-text-primary"
        >
          <option value="All">All priorities</option>
          <option value="IMR">IMR</option>
          <option value="OBS">OBS</option>
          <option value="PM">PM</option>
          <option value="Routine">Routine</option>
        </select>

        {pendingSelected.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-text-secondary">
              {pendingSelected.length} selected
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
            <th className="px-4 py-2 w-8">
              <button onClick={toggleAll} className="flex items-center">
                {selected.size === filtered.length && filtered.length > 0 ? (
                  <CheckSquare size={14} strokeWidth={1.75} />
                ) : (
                  <Square size={14} strokeWidth={1.75} />
                )}
              </button>
            </th>
            <th className="px-4 py-2 font-medium">Priority</th>
            <th className="px-4 py-2 font-medium">Block ID</th>
            <th className="px-4 py-2 font-medium">Dept</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium">Section</th>
            <th className="px-4 py-2 font-medium">Date / Time</th>
            <th className="px-4 py-2 font-medium">Duration</th>
            <th className="px-4 py-2 font-medium">Confidence</th>
            <th className="px-4 py-2 font-medium">Shadow</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Actions</th>
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
                  className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${priorityStyle[req.priority]}`}
                >
                  {req.priority}
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
                {req.status === "Pending" ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-1 rounded hover:bg-surface-sunken transition-colors"
                      title="View in twin"
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
