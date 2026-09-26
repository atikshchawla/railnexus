"use client";

import { useState } from "react";
import { X, XCircle } from "lucide-react";
import type { ApprovalProposalRecord } from "@/lib/types";
import { getShortProposalId } from "./approval-utils";

interface RejectModalProps {
  proposal: ApprovalProposalRecord;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function RejectModal({
  proposal,
  onConfirm,
  onClose,
  loading,
}: RejectModalProps) {
  const [rejectCategory, setRejectCategory] = useState("SECTION_CONGESTION");
  const [rejectReasonNotes, setRejectReasonNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rejectReasonNotes.trim();
    const fullReason = trimmed
      ? `[${rejectCategory}] ${trimmed}`
      : `[${rejectCategory}] Declined by Section Controller during shift review`;

    await onConfirm(fullReason);
  };

  const shortId = getShortProposalId(proposal.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border-default max-w-md w-full shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border-default flex items-center justify-between bg-surface-sunken shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-critical/15 text-critical">
              <XCircle size={16} />
            </span>
            <div>
              <h2 className="text-[13.5px] font-bold text-critical">
                Reject Block Proposal
              </h2>
              <p className="text-[11px] text-text-secondary font-mono">
                {shortId} &bull; {proposal.section_id}
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

        {/* Reject Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-5 space-y-3.5 text-[12px]">
            <p className="text-text-primary">
              Declining this proposal closes it without promotion to an OperationalBlock. The rejection and controller rationale will be permanently recorded in the audit log.
            </p>

            <label className="flex flex-col gap-1 font-semibold text-text-primary">
              Rejection Reason Category
              <select
                value={rejectCategory}
                onChange={(e) => setRejectCategory(e.target.value)}
                className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-brand cursor-pointer"
              >
                <option value="SECTION_CONGESTION">SECTION_CONGESTION &bull; Traffic density too high</option>
                <option value="INSUFFICIENT_WINDOW">INSUFFICIENT_WINDOW &bull; Duration inadequate for work</option>
                <option value="CREW_UNAVAILABLE">CREW_UNAVAILABLE &bull; Department staff / machine unavailable</option>
                <option value="CONFLICTING_MOVEMENT">CONFLICTING_MOVEMENT &bull; High priority express path conflict</option>
                <option value="OTHER">OTHER &bull; Operational discretion</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 font-semibold text-text-primary">
              Controller Rejection Notes
              <textarea
                rows={3}
                value={rejectReasonNotes}
                onChange={(e) => setRejectReasonNotes(e.target.value)}
                placeholder="Provide operational reason for rejection..."
                className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-brand resize-none"
              />
            </label>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 bg-surface-sunken border-t border-border-default flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 text-[11.5px] font-semibold border border-border-default text-text-secondary hover:bg-surface transition-colors rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-[11.5px] font-bold bg-critical text-white hover:bg-critical/90 transition-colors rounded disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Declining..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
