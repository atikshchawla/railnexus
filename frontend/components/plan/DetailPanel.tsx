"use client";

import type { ChartBlock, TrainPath, DerivedConflict, Station } from "@/lib/types";
import { formatTime, getDeptColor, PRIORITY_BORDER, type PriorityTier } from "@/lib/chart-engine";

interface DetailPanelProps {
  selectedId: string;
  selectedType: "block" | "train" | "conflict";
  blocks: ChartBlock[];
  trains: TrainPath[];
  conflicts: DerivedConflict[];
  stations: Station[];
  onClose: () => void;
  onApplyResolution: (conflictId: string, resolutionIdx: number) => void;
  onApproveBlock: (blockId: string) => void;
}

export default function DetailPanel({
  selectedId,
  selectedType,
  blocks,
  trains,
  conflicts,
  stations,
  onClose,
  onApplyResolution,
  onApproveBlock,
}: DetailPanelProps) {
  const resolveStation = (id: string) => stations.find(s => s.id === id)?.name ?? id;

  // ─── Block ──────────────────────────────────────────────
  if (selectedType === "block") {
    const block = blocks.find(b => b.id === selectedId);
    if (!block) return null;
    const pBorder = PRIORITY_BORDER[block.priorityTier as PriorityTier] || PRIORITY_BORDER["P4-low"];
    const relatedConflicts = conflicts.filter(c => c.blockId === block.id || c.otherBlockId === block.id);

    return (
      <div className="w-[320px] shrink-0 border-l border-border-default bg-surface flex flex-col overflow-y-auto">
        <Header title="Block details" onClose={onClose} />
        <div className="p-4 space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide"
              style={{ color: getDeptColor(block.department), backgroundColor: getDeptColor(block.department) + "18" }}>
              {block.department}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 border border-border-default text-text-secondary uppercase">
              {block.status}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 uppercase"
              style={{ color: pBorder.color, borderLeft: `${pBorder.width}px solid ${pBorder.color}`, paddingLeft: 6 }}>
              {block.priorityTier}
            </span>
            {block.isShadow && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-surface-sunken text-text-secondary uppercase tracking-widest">
                Shadow
              </span>
            )}
          </div>

          <div>
            <h4 className="text-[16px] font-semibold text-text-primary">{block.id}</h4>
            <p className="text-[13px] text-text-secondary mt-0.5">{block.description}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            <dt className="text-text-secondary">Location</dt>
            <dd className="num font-medium">Km {block.km_start}–{block.km_end} ({block.affected_line})</dd>
            <dt className="text-text-secondary">Time</dt>
            <dd className="num">{formatTime(block.time_start)} – {formatTime(block.time_end)}</dd>
            <dt className="text-text-secondary">Category</dt>
            <dd>{block.category}</dd>
            <dt className="text-text-secondary">Urgency</dt>
            <dd className="font-medium">{block.urgency?.deadline}</dd>
            {block.parentBlockId && (
              <>
                <dt className="text-text-secondary">Parent block</dt>
                <dd className="font-medium">{block.parentBlockId}</dd>
              </>
            )}
          </dl>

          {/* Related conflicts */}
          {relatedConflicts.length > 0 && (
            <div className="pt-3 border-t border-border-default">
              <h5 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Conflicts ({relatedConflicts.length})</h5>
              {relatedConflicts.map(c => (
                <div key={c.id} className="text-[12px] p-2 border border-border-default mb-1">
                  <span className="font-medium text-critical">{c.id}</span>
                  <span className="text-text-secondary ml-1">— {c.overlap_minutes} min overlap with {c.trainId ?? c.otherBlockId}</span>
                </div>
              ))}
            </div>
          )}

          {/* Approve action */}
          {(block.status === "proposed" || block.status === "approved") && !block.isShadow && (
            <div className="pt-3 border-t border-border-default">
              <button
                onClick={() => onApproveBlock(block.id)}
                className="w-full py-2 bg-brand text-white text-[12px] font-medium hover:bg-brand-hover transition-colors"
              >
                {block.status === "proposed" ? "Approve block" : "Mark as active"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Train ──────────────────────────────────────────────
  if (selectedType === "train") {
    const train = trains.find(t => t.id === selectedId);
    if (!train) return null;
    const relatedConflicts = conflicts.filter(c => c.trainId === train.id);

    return (
      <div className="w-[320px] shrink-0 border-l border-border-default bg-surface flex flex-col overflow-y-auto">
        <Header title="Train details" onClose={onClose} />
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-1.5 py-0.5 border border-border-default text-text-secondary uppercase">
              {train.type}
            </span>
          </div>
          <div>
            <h4 className="text-[16px] font-semibold text-text-primary">{train.id}</h4>
            <p className="text-[13px] text-text-secondary">{train.name}</p>
          </div>

          <div className="space-y-3">
            <h5 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Scheduled stops</h5>
            <div className="relative border-l-2 border-border-default ml-2 space-y-3">
              {train.stops.map((stop, i) => (
                <div key={i} className="relative pl-4">
                  <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-border-default ring-2 ring-surface" />
                  <p className="text-[12px] font-medium text-text-primary leading-none">
                    {resolveStation(stop.stationId)}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5 num">
                    Km {stop.km} — {formatTime(stop.time)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {relatedConflicts.length > 0 && (
            <div className="pt-3 border-t border-border-default">
              <h5 className="text-[11px] font-semibold text-critical uppercase tracking-wider mb-2">
                Conflicts ({relatedConflicts.length})
              </h5>
              {relatedConflicts.map(c => (
                <div key={c.id} className="text-[12px] p-2 border border-critical/30 bg-critical/5 mb-1">
                  <span className="font-medium text-critical">{c.id}</span>
                  <span className="text-text-secondary ml-1">— Block {c.blockId}, {c.overlap_minutes} min overlap</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Conflict ───────────────────────────────────────────
  if (selectedType === "conflict") {
    const conflict = conflicts.find(c => c.id === selectedId);
    if (!conflict) return null;

    return (
      <div className="w-[320px] shrink-0 border-l border-border-default bg-surface flex flex-col overflow-y-auto">
        <Header title="Conflict details" onClose={onClose} />
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-critical/10 text-critical uppercase tracking-wide">
              Derived conflict
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 uppercase"
              style={{ color: (PRIORITY_BORDER[conflict.priorityTier as PriorityTier] || PRIORITY_BORDER["P4-low"]).color }}>
              {conflict.priorityTier}
            </span>
          </div>
          <div>
            <h4 className="text-[16px] font-semibold text-text-primary">{conflict.id}</h4>
            <p className="text-[13px] text-text-secondary mt-0.5">
              {conflict.trainId
                ? `Block ${conflict.blockId} intersects Train ${conflict.trainId}`
                : `Block ${conflict.blockId} overlaps Block ${conflict.otherBlockId}`}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            <dt className="text-text-secondary">Intersection</dt>
            <dd className="num font-medium">Km {conflict.intersectionKm.toFixed(1)} at {formatTime(conflict.intersectionTime)}</dd>
            <dt className="text-text-secondary">Overlap</dt>
            <dd className="text-critical font-semibold num">{conflict.overlap_minutes} mins</dd>
            <dt className="text-text-secondary">Km range</dt>
            <dd className="num">Km {conflict.km_start}–{conflict.km_end}</dd>
            <dt className="text-text-secondary">Time window</dt>
            <dd className="num">{formatTime(conflict.time_start)} – {formatTime(conflict.time_end)}</dd>
          </dl>

          {/* AI Resolutions */}
          <div className="pt-3 border-t border-border-default space-y-2">
            <h5 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
              </svg>
              AI-suggested resolutions
            </h5>
            {conflict.candidate_resolutions.map((res: string, i: number) => (
              <div key={i} className="p-3 border border-border-default bg-surface-sunken">
                <p className="text-[12px] text-text-primary mb-2.5 leading-relaxed">{res}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApplyResolution(conflict.id, i)}
                    className="flex-1 py-1.5 bg-brand text-white text-[11px] font-medium hover:bg-brand-hover transition-colors"
                  >
                    Apply
                  </button>
                  <button className="flex-1 py-1.5 border border-border-default text-text-primary text-[11px] font-medium hover:bg-surface transition-colors">
                    Send for approval
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="px-4 py-2.5 border-b border-border-default bg-surface-sunken flex items-center justify-between shrink-0">
      <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
      <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-[18px] leading-none touch-target"
        aria-label="Close panel">×</button>
    </div>
  );
}
