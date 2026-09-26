"use client";

import { X, CheckSquare, ShieldCheck, AlertTriangle } from "lucide-react";
import type { ApprovalProposalRecord } from "@/lib/types";
import { formatTime, getShortProposalId } from "./approval-utils";

interface BatchApprovalConfirmModalProps {
  selectedProposals: ApprovalProposalRecord[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
  progressText?: string;
}

export function BatchApprovalConfirmModal({
  selectedProposals,
  onConfirm,
  onClose,
  loading,
  progressText,
}: BatchApprovalConfirmModalProps) {
  const proposalCount = selectedProposals.length;
  const totalRequests = selectedProposals.reduce(
    (sum, p) => sum + p.maintenance_request_ids.length,
    0,
  );
  const totalSaving = selectedProposals.reduce(
    (sum, p) => sum + (p.possession_saving_minutes || 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border-default max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border-default flex items-center justify-between bg-surface-sunken shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-brand/15 text-brand">
              <CheckSquare size={16} />
            </span>
            <div>
              <h2 className="text-[13.5px] font-bold text-text-primary">
                Batch Authorize {proposalCount} Proposals
              </h2>
              <p className="text-[11px] text-text-secondary">
                {totalRequests} maintenance requests &bull; +{totalSaving.toFixed(0)} min total saving
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-text-secondary hover:text-text-primary text-[18px] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-[12px] overflow-y-auto">
          <p className="text-text-secondary">
            You are authorizing multiple block proposals at once. Each proposal will pass through the authoritative backend conflict safety gate and create an individual <strong>OperationalBlock</strong>.
          </p>

          {/* Table of selected proposals */}
          <div className="border border-border-default rounded overflow-hidden">
            <table className="w-full text-left text-[11.5px]">
              <thead className="bg-surface-sunken text-text-secondary text-[10px] uppercase font-semibold border-b border-border-default">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Schedule</th>
                  <th className="px-3 py-2 text-center">Requests</th>
                  <th className="px-3 py-2 text-right">Saving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {selectedProposals.map((p) => {
                  const shortId = getShortProposalId(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-surface-sunken/40">
                      <td className="px-3 py-2 font-mono font-bold text-brand">{shortId}</td>
                      <td className="px-3 py-2 font-medium text-text-primary">{p.section_id}</td>
                      <td className="px-3 py-2 text-text-secondary font-mono text-[11px]">
                        {formatTime(p.proposed_start_time)} – {formatTime(p.proposed_end_time)}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-text-primary">
                        {p.maintenance_request_ids.length}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-positive">
                        +{p.possession_saving_minutes.toFixed(0)}m
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 p-2 bg-positive/10 border border-positive/25 rounded text-positive text-[11px] font-medium">
            <ShieldCheck size={14} className="shrink-0" />
            <span>All {proposalCount} selected proposals are conflict-free and verified eligible.</span>
          </div>

          {progressText && (
            <div className="text-[12px] font-semibold text-brand animate-pulse">
              {progressText}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-surface-sunken border-t border-border-default flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-[11.5px] font-semibold border border-border-default text-text-secondary hover:bg-surface transition-colors rounded cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-[11.5px] font-bold bg-brand text-white hover:bg-brand-hover transition-colors rounded cursor-pointer disabled:opacity-50"
          >
            {loading ? "Authorizing Queue..." : `Authorize ${proposalCount} Proposals (${totalRequests} Req)`}
          </button>
        </div>
      </div>
    </div>
  );
}
