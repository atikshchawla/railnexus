import { AlertTriangle, Merge, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import type { Conflict } from "@/lib/types";

interface ConflictCardProps {
  conflict: Conflict;
}

export default function ConflictCard({ conflict }: ConflictCardProps) {
  return (
    <div className={`bg-surface border ${conflict.resolved ? "border-border-default" : "border-critical/30"}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
        <AlertTriangle
          size={14}
          strokeWidth={2}
          className={conflict.resolved ? "text-success" : "text-critical"}
        />
        <span className="text-[13px] font-semibold text-text-primary">
          {conflict.id}
        </span>
        <span
          className={`ml-auto text-[11px] font-medium ${
            conflict.resolved ? "text-success" : "text-critical"
          }`}
        >
          {conflict.resolved ? "Resolved" : "Unresolved"}
        </span>
      </div>

      {/* Two-sided display */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-0">
        {/* Block A */}
        <div className="px-4 py-3">
          <div className="text-[12px] text-text-secondary mb-1">Block A</div>
          <div className="text-[13px] font-medium">{conflict.blockA.id}</div>
          <div className="text-[12px] text-text-secondary">{conflict.blockA.department}</div>
          <div className="text-[12.5px] mt-1">{conflict.blockA.description}</div>
          <div className="text-[11px] text-text-secondary mt-0.5 num">{conflict.blockA.section}</div>
          <div className="text-[11px] text-text-secondary num">{conflict.blockA.time}</div>
        </div>

        {/* Overlap indicator */}
        <div className="flex flex-col items-center justify-center px-3 border-x border-border-default bg-surface-sunken">
          <ArrowRightLeft size={16} strokeWidth={1.5} className="text-critical mb-1" />
          <div className="text-[10px] text-critical font-medium text-center leading-tight">
            {conflict.overlapKm}
          </div>
          <div className="text-[10px] text-text-secondary text-center mt-0.5">
            {conflict.overlapTime}
          </div>
        </div>

        {/* Block B */}
        <div className="px-4 py-3">
          <div className="text-[12px] text-text-secondary mb-1">Block B</div>
          <div className="text-[13px] font-medium">{conflict.blockB.id}</div>
          <div className="text-[12px] text-text-secondary">{conflict.blockB.department}</div>
          <div className="text-[12.5px] mt-1">{conflict.blockB.description}</div>
          <div className="text-[11px] text-text-secondary mt-0.5 num">{conflict.blockB.section}</div>
          <div className="text-[11px] text-text-secondary num">{conflict.blockB.time}</div>
        </div>
      </div>

      {/* Resolution actions */}
      {!conflict.resolved && (
        <div className="px-4 py-2.5 border-t border-border-default flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors">
            <Merge size={13} strokeWidth={2} />
            Merge into combined block
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors">
            <ArrowRightLeft size={13} strokeWidth={2} />
            Sequence (A then B)
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-critical hover:bg-critical/5 transition-colors">
            <ArrowUpRight size={13} strokeWidth={2} />
            Escalate
          </button>
        </div>
      )}
    </div>
  );
}
