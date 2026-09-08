"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { Department, UrgencyTier, BlockStatus, AuditEntry, AISuggestion } from "@/lib/types";
import { formatConfidence, formatRelativeTime } from "@/lib/rules";

// ─── Constants ────────────────────────────────────────────────────────
const DEPT_COLORS: Record<Department, string> = {
  Engg: "#B45309", // amber-700
  TRD: "#1D4ED8",  // blue-700
  "S&T": "#15803D", // green-700
};

const URGENCY_COLORS: Record<UrgencyTier, string> = {
  critical: "#DC2626", // red-600
  warning: "#EA580C",  // orange-600
  caution: "#CA8A04",  // yellow-700
  routine: "#6B7280",  // gray-500
};

const STATUS_COLORS: Record<BlockStatus, string> = {
  Draft: "#6B7280",
  Submitted: "#6B7280",
  "Under review": "#CA8A04",
  Approved: "#15803D",
  Active: "#1D4ED8",
  Closed: "#374151",
  Rejected: "#DC2626",
};

// ─── Components ───────────────────────────────────────────────────────

export function DepartmentBadge({ dept }: { dept: Department }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide"
      style={{ backgroundColor: DEPT_COLORS[dept] }}
    >
      {dept}
    </span>
  );
}

export function UrgencyText({ tier, text }: { tier: UrgencyTier; text: string }) {
  return (
    <span className="font-semibold text-[12px]" style={{ color: URGENCY_COLORS[tier] }}>
      {text}
    </span>
  );
}

export function UrgencyBorder({ tier, children, className = "" }: { tier: UrgencyTier; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`border-l-[3px] ${className}`} style={{ borderLeftColor: URGENCY_COLORS[tier] }}>
      {children}
    </div>
  );
}

export function ConflictIndicator({ conflictId, showText = true }: { conflictId?: string; showText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: "#DC2626" }}>
      <AlertTriangle size={16} strokeWidth={2.5} />
      {showText && <span className="text-[12px] font-semibold">{conflictId ?? "Conflict"}</span>}
    </span>
  );
}

export function StatusPill({ status }: { status: BlockStatus }) {
  const hex = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center justify-center rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        backgroundColor: `${hex}26`, // 15% opacity approx (hex 26)
        color: hex,
      }}
    >
      {status}
    </span>
  );
}

export function ConfidenceDisplay({
  aiSuggestion,
  onExpanded,
}: {
  aiSuggestion: AISuggestion;
  onExpanded?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded(!expanded);
    if (!expanded && onExpanded) onExpanded();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 cursor-pointer select-none group" onClick={handleToggle}>
        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${aiSuggestion.confidence}%`, backgroundColor: "#475569" }}
          />
        </div>
        <p className="text-[12px] text-text-primary group-hover:text-brand transition-colors leading-tight truncate max-w-md">
          {formatConfidence(aiSuggestion.confidence, aiSuggestion.confidenceBasis, aiSuggestion.topFactors[0])}
        </p>
        {expanded ? <ChevronDown size={14} className="text-text-secondary" /> : <ChevronRight size={14} className="text-text-secondary" />}
      </div>

      {expanded && (
        <div className="pl-[4.5rem] pr-2 py-1 space-y-2">
          <div className="text-[11px] text-text-secondary space-y-1">
            <p className="font-semibold uppercase tracking-wider text-text-primary">Top factors:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {aiSuggestion.topFactors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          </div>
          <div className="text-[11px] font-semibold text-text-primary bg-surface-sunken p-2 border border-border-default">
            Recommendation: {aiSuggestion.recommendedAction}
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditLog({ entry }: { entry: AuditEntry }) {
  return (
    <div className="text-[11px] text-text-secondary">
      <span className="font-medium text-text-primary">{entry.action}</span> by {entry.actor}, {entry.role} &middot; {formatRelativeTime(entry.timestamp)}
      {entry.agreedWithAI !== null && (
        <span className="ml-1 italic">
          ({entry.agreedWithAI ? "agreed with AI" : "overrode AI"})
        </span>
      )}
    </div>
  );
}

export function AcronymLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-secondary bg-surface-sunken border border-border-default px-3 py-1.5">
      <span className="font-semibold text-text-primary mr-2 uppercase tracking-wide">Legend:</span>
      <abbr title="Immediate Repair" className="cursor-help no-underline border-b border-dashed border-text-secondary">IMR = Immediate Repair</abbr> &middot;
      <abbr title="Observation" className="cursor-help no-underline border-b border-dashed border-text-secondary">OBS = Observation</abbr> &middot;
      <abbr title="Preventive Maintenance" className="cursor-help no-underline border-b border-dashed border-text-secondary">PM = Preventive Maintenance</abbr> &middot;
      <abbr title="Track Management System" className="cursor-help no-underline border-b border-dashed border-text-secondary">TMS</abbr> &middot;
      <abbr title="Signal Maintenance Management System" className="cursor-help no-underline border-b border-dashed border-text-secondary">SMMS</abbr> &middot;
      <abbr title="Traction Distribution Management System" className="cursor-help no-underline border-b border-dashed border-text-secondary">TDMS</abbr> &middot;
      <abbr title="Service Level Agreement" className="cursor-help no-underline border-b border-dashed border-text-secondary">SLA</abbr>
    </div>
  );
}
