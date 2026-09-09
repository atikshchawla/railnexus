"use client";

/**
 * ChartLegend — Two-row, always-visible legend bar.
 * Rendered OUTSIDE the scrollable chart area.
 */
export default function ChartLegend() {
  return (
    <div className="shrink-0 border-t border-border-default bg-surface px-4 py-2 space-y-1.5">
      {/* Row 1: Departments + Status + Shadow */}
      <div className="flex items-center gap-5 text-[11px] text-text-secondary flex-wrap">
        <span className="text-[10px] font-semibold text-text-primary uppercase tracking-wider mr-1">Dept</span>
        <LegendSwatch color="var(--status-info)" label="Engg" />
        <LegendSwatch color="var(--status-warning)" label="TRD" />
        <LegendSwatch color="var(--status-success)" label="S&T" />

        <span className="border-l border-border-default pl-4 text-[10px] font-semibold text-text-primary uppercase tracking-wider mr-1">Status</span>
        <LegendBorder dasharray="6,4" label="Proposed" />
        <LegendBorder dasharray="none" label="Approved" />
        <LegendBorder dasharray="none" label="Active" thick />

        <span className="border-l border-border-default pl-4">
          <span className="inline-flex items-center gap-1">
            <svg width={16} height={12}>
              <line x1={0} x2={8} y1={0} y2={12} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
              <line x1={8} x2={0} y1={0} y2={12} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
              <line x1={8} x2={16} y1={0} y2={12} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
              <line x1={16} x2={8} y1={0} y2={12} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
            </svg>
            <span>Shadow</span>
          </span>
        </span>
      </div>

      {/* Row 2: Trains + Conflicts + NOW + Priority */}
      <div className="flex items-center gap-5 text-[11px] text-text-secondary flex-wrap">
        <span className="text-[10px] font-semibold text-text-primary uppercase tracking-wider mr-1">Trains</span>
        <span className="inline-flex items-center gap-1.5">
          <svg width={20} height={2}><line x1={0} x2={20} y1={1} y2={1} stroke="var(--text-primary)" strokeWidth={1.5} /></svg>
          Passenger
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width={20} height={2}><line x1={0} x2={20} y1={1} y2={1} stroke="var(--text-primary)" strokeWidth={1.5} strokeDasharray="6,4" /></svg>
          Freight
        </span>

        <span className="border-l border-border-default pl-4 inline-flex items-center gap-1.5">
          <svg width={12} height={12}>
            <polygon points="6,1 11,6 6,11 1,6" fill="none" stroke="var(--status-critical)" strokeWidth={2} />
          </svg>
          Conflict
        </span>

        <span className="border-l border-border-default pl-4 inline-flex items-center gap-1.5">
          <svg width={2} height={12}><line x1={1} x2={1} y1={0} y2={12} stroke="var(--status-critical)" strokeWidth={2} /></svg>
          NOW
        </span>

        <span className="border-l border-border-default pl-4 text-[10px] font-semibold text-text-primary uppercase tracking-wider mr-1">Priority</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1 h-3 bg-critical" />P1
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-0.5 h-3 bg-warning" />P2
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-px h-3 bg-info" />P3
        </span>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-3 h-2.5" style={{ backgroundColor: color, opacity: 0.3, border: `1.5px solid ${color}` }} />
      {label}
    </span>
  );
}

function LegendBorder({ dasharray, label, thick }: { dasharray: string; label: string; thick?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={16} height={10}>
        <rect x={1} y={1} width={14} height={8} fill="none"
          stroke="var(--text-secondary)" strokeWidth={thick ? 2.5 : 1.5}
          strokeDasharray={dasharray} />
      </svg>
      {label}
    </span>
  );
}
