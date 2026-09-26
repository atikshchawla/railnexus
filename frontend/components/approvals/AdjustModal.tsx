"use client";

import { useState } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import type { ApprovalProposalRecord, ProposalApprovePayload } from "@/lib/types";
import { getShortProposalId } from "./approval-utils";

interface AdjustModalProps {
  proposal: ApprovalProposalRecord;
  initialStartKm: number;
  initialEndKm: number;
  initialTrackLine: string;
  initialLeadDept: string;
  onConfirm: (payload: ProposalApprovePayload) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function AdjustModal({
  proposal,
  initialStartKm,
  initialEndKm,
  initialTrackLine,
  initialLeadDept,
  onConfirm,
  onClose,
  loading,
}: AdjustModalProps) {
  const [adjustStart, setAdjustStart] = useState(
    proposal.proposed_start_time ? proposal.proposed_start_time.slice(0, 16) : "",
  );
  const [adjustEnd, setAdjustEnd] = useState(
    proposal.proposed_end_time ? proposal.proposed_end_time.slice(0, 16) : "",
  );
  const [adjustStartKm, setAdjustStartKm] = useState<number>(initialStartKm);
  const [adjustEndKm, setAdjustEndKm] = useState<number>(initialEndKm);
  const [adjustTrackLine, setAdjustTrackLine] = useState(initialTrackLine);
  const [adjustLeadDept, setAdjustLeadDept] = useState(initialLeadDept);
  const [adjustOverrideCode, setAdjustOverrideCode] = useState("TRAFFIC_CONSTRAINT");
  const [adjustJustification, setAdjustJustification] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustJustification.trim()) {
      alert("An explicit human justification is required for manual override.");
      return;
    }
    if (adjustEndKm <= adjustStartKm) {
      alert("End Km must be strictly greater than Start Km.");
      return;
    }

    const payload: ProposalApprovePayload = {
      block_id: `OP-${proposal.section_id}-${proposal.id.slice(0, 8).toUpperCase()}`,
      approved_by: "CTRL-01",
      lead_department: adjustLeadDept,
      start_km: Number(adjustStartKm),
      end_km: Number(adjustEndKm),
      track_line: adjustTrackLine,
      override_justification: adjustJustification.trim(),
      override_code: adjustOverrideCode,
      operator_role: "SECTION_CONTROLLER",
      custom_scheduled_start: adjustStart ? new Date(adjustStart).toISOString() : undefined,
      custom_scheduled_end: adjustEnd ? new Date(adjustEnd).toISOString() : undefined,
    };

    await onConfirm(payload);
  };

  const shortId = getShortProposalId(proposal.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border-default max-w-lg w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border-default flex items-center justify-between bg-surface-sunken shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/15 text-amber-600">
              <SlidersHorizontal size={16} />
            </span>
            <div>
              <h2 className="text-[13.5px] font-bold text-text-primary">
                Human Controller Manual Override (Adjust)
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

        {/* Adjust Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-3.5 overflow-y-auto text-[12px] flex-1">
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded text-amber-700 dark:text-amber-300 text-[11.5px]">
              <strong>Audited Human Override:</strong> Altering AI parameters stages a formal{" "}
              <code className="bg-black/10 px-1 py-0.5 rounded font-mono">ManualOverride</code> record in the database. The resulting OperationalBlock will be permanently marked as Controller-Adjusted.
            </div>

            {/* Timing Adjustments */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-semibold text-text-primary">
                Adjusted Start Time
                <input
                  type="datetime-local"
                  value={adjustStart}
                  onChange={(e) => setAdjustStart(e.target.value)}
                  className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] font-mono outline-none focus:border-brand"
                />
              </label>

              <label className="flex flex-col gap-1 font-semibold text-text-primary">
                Adjusted End Time
                <input
                  type="datetime-local"
                  value={adjustEnd}
                  onChange={(e) => setAdjustEnd(e.target.value)}
                  className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] font-mono outline-none focus:border-brand"
                />
              </label>
            </div>

            {/* Spatial Bounds */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-semibold text-text-primary">
                Start Km
                <input
                  type="number"
                  step="0.1"
                  value={adjustStartKm}
                  onChange={(e) => setAdjustStartKm(parseFloat(e.target.value) || 0)}
                  className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] font-mono outline-none focus:border-brand"
                />
              </label>

              <label className="flex flex-col gap-1 font-semibold text-text-primary">
                End Km
                <input
                  type="number"
                  step="0.1"
                  value={adjustEndKm}
                  onChange={(e) => setAdjustEndKm(parseFloat(e.target.value) || 0)}
                  className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] font-mono outline-none focus:border-brand"
                />
              </label>
            </div>

            {/* Track Line & Lead Dept */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-semibold text-text-primary">
                Track Line
                <select
                  value={adjustTrackLine}
                  onChange={(e) => setAdjustTrackLine(e.target.value)}
                  className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-brand cursor-pointer"
                >
                  <option value="UP">UP Line</option>
                  <option value="DN">DN Line</option>
                  <option value="BOTH">BOTH Lines</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 font-semibold text-text-primary">
                Lead Department
                <select
                  value={adjustLeadDept}
                  onChange={(e) => setAdjustLeadDept(e.target.value)}
                  className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-brand cursor-pointer"
                >
                  <option value="ENGG">Engineering (ENGG)</option>
                  <option value="TRD">Traction (TRD)</option>
                  <option value="S&T">Signalling (S&T)</option>
                </select>
              </label>
            </div>

            {/* Mandatory Override Code */}
            <label className="flex flex-col gap-1 font-semibold text-text-primary">
              Mandatory Override Reason Code
              <select
                value={adjustOverrideCode}
                onChange={(e) => setAdjustOverrideCode(e.target.value)}
                className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-brand cursor-pointer"
              >
                <option value="TRAFFIC_CONSTRAINT">TRAFFIC_CONSTRAINT &bull; Express / Freight traffic density</option>
                <option value="CREW_AVAILABILITY">CREW_AVAILABILITY &bull; Work crew / machine mobilization shift</option>
                <option value="WEATHER_EMERGENCY">WEATHER_EMERGENCY &bull; Adverse weather conditions</option>
                <option value="OPERATIONAL_PRIORITY">OPERATIONAL_PRIORITY &bull; Division operational priority escalation</option>
                <option value="SAFETY_CRITICAL">SAFETY_CRITICAL &bull; Urgent track safety clearance</option>
              </select>
            </label>

            {/* Mandatory Justification Notes */}
            <label className="flex flex-col gap-1 font-semibold text-text-primary">
              Detailed Human Justification Notes *
              <textarea
                rows={3}
                value={adjustJustification}
                onChange={(e) => setAdjustJustification(e.target.value)}
                placeholder="Explain why the AI recommended parameters were modified by controller..."
                className="bg-surface-sunken border border-border-default px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-brand resize-none"
                required
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
              disabled={loading || !adjustJustification.trim()}
              className="px-4 py-1.5 text-[11.5px] font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors rounded disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Staging..." : "Authorize Adjusted Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
