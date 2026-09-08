"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout";
import { SearchBar } from "@/components/shared";
import { mockConflicts, mockBlocks, mockTrainPaths } from "@/lib/mock-data";
import { computeConflicts } from "@/lib/chart-engine";
import { DepartmentBadge, UrgencyBorder } from "@/components/shared";
import { AlertTriangle, ArrowRightLeft, Merge, Eye, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/rules";
import type { ConflictRecord, Department } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getConflictSeverityColor(severity: string) {
  switch (severity) {
    case "high": return "critical";
    case "medium": return "warning";
    case "low": return "caution";
    default: return "routine";
  }
}

// ─── Modal Component ──────────────────────────────────────────────────

function PreviewModal({
  conflict,
  actionName,
  onClose,
  onConfirm
}: {
  conflict: ConflictRecord;
  actionName: "Merge" | "Sequence";
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  
  const blockA = mockBlocks.find(b => b.id === conflict.blockAId)!;
  const blockB = mockBlocks.find(b => b.id === conflict.blockBId)!;

  // Compute combined window
  const startA = new Date(blockA.scheduledWindow.start).getTime();
  const endA = new Date(blockA.scheduledWindow.end).getTime();
  const startB = new Date(blockB.scheduledWindow.start).getTime();
  const endB = new Date(blockB.scheduledWindow.end).getTime();
  
  const combinedStart = actionName === "Merge" ? Math.min(startA, startB) : Math.min(startA, startB);
  const combinedEnd = actionName === "Merge" ? Math.max(endA, endB) : (startA < startB ? endA + (endB - startB) : endB + (endA - startA)); // simplification
  const leadDept = blockA.urgency.timeToBreachHours !== null && blockB.urgency.timeToBreachHours !== null 
    ? (blockA.urgency.timeToBreachHours < blockB.urgency.timeToBreachHours ? blockA.department : blockB.department) 
    : blockA.department;

  // Check affected trains using chart engine logic
  const mockChartBlocks = [{
    id: "COMBINED", department: leadDept,
    km_start: Math.min(blockA.location.kmStart, blockB.location.kmStart),
    km_end: Math.max(blockA.location.kmEnd, blockB.location.kmEnd),
    time_start: combinedStart - new Date().setHours(0,0,0,0),
    time_end: combinedEnd - new Date().setHours(0,0,0,0),
    status: "active", isShadow: false, label: "Combined", priorityTier: "P1-critical" as any
  }];
  
  const newlyAffectedTrains = computeConflicts(mockChartBlocks, mockTrainPaths).map(c => mockTrainPaths.find(t => t.id === c.trainId)!);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface border border-border-default max-w-lg w-full shadow-lg flex flex-col">
        <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text-primary">Preview: {actionName} {conflict.id}</h2>
        </div>
        
        <div className="p-5 space-y-4 text-[13px]">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-sunken p-3 border border-border-default">
              <p className="text-text-secondary text-[11px] mb-1">Resulting time window</p>
              <p className="font-semibold text-text-primary">
                {new Date(combinedStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} – {new Date(combinedEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </p>
            </div>
            <div className="bg-surface-sunken p-3 border border-border-default">
              <p className="text-text-secondary text-[11px] mb-1">Lead department</p>
              <p className="font-semibold text-text-primary"><DepartmentBadge dept={leadDept} /></p>
            </div>
          </div>
          
          <div>
            <p className="text-text-secondary text-[11px] mb-1">Newly affected trains</p>
            {newlyAffectedTrains.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1 text-text-primary">
                {newlyAffectedTrains.map(t => (
                  <li key={t.id}><span className="font-medium">{t.id}</span> {t.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-text-primary font-medium italic">No additional trains affected</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border-default">
            <label className="block text-[11px] font-semibold text-text-primary uppercase tracking-wide mb-2">
              Type CONFIRM to execute
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border-default bg-surface-sunken text-text-primary text-[14px]"
              placeholder="CONFIRM"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 bg-surface-sunken border-t border-border-default flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-medium text-text-primary hover:bg-surface border border-transparent transition-colors">
            Cancel
          </button>
          <button 
            disabled={confirmText !== "CONFIRM"}
            onClick={onConfirm}
            className="px-4 py-2 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm {actionName}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function ConflictsPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  
  const [previewAction, setPreviewAction] = useState<{conflict: ConflictRecord, action: "Merge" | "Sequence"} | null>(null);

  const filtered = mockConflicts.filter(c => {
    // Quick search
    if (search && !c.id.toLowerCase().includes(search.toLowerCase()) && !c.overlapDescription.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Derived severity filter (mock logic)
    const severity = c.id === "CONF-001" ? "high" : c.id === "CONF-002" ? "medium" : "low";
    if (severityFilter !== "All" && severity !== severityFilter) return false;

    // Dept filter
    const bA = mockBlocks.find(b => b.id === c.blockAId)!;
    const bB = mockBlocks.find(b => b.id === c.blockBId)!;
    if (deptFilter !== "All" && bA.department !== deptFilter && bB.department !== deptFilter) return false;
    
    return true;
  });

  const unresolved = filtered.filter(c => c.status === "Unresolved")
    .sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime());
    
  const resolved = filtered.filter(c => c.status === "Resolved")
    .sort((a, b) => new Date(b.resolution!.timestamp).getTime() - new Date(a.resolution!.timestamp).getTime());

  return (
    <>
      <TopBar title="Conflict resolution" subtitle="Resolve cross-department overlaps" />
      
      {previewAction && (
        <PreviewModal 
          conflict={previewAction.conflict} 
          actionName={previewAction.action}
          onClose={() => setPreviewAction(null)}
          onConfirm={() => { alert(`Audit Log: ${previewAction.action} executed on ${previewAction.conflict.id}`); setPreviewAction(null); }}
        />
      )}

      <div className="flex-1 p-5 overflow-y-auto bg-canvas space-y-6">
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by ID or description..." />
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary">
            <option value="All">All Departments</option>
            <option value="Engg">Engg</option>
            <option value="TRD">TRD</option>
            <option value="S&T">S&T</option>
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary">
            <option value="All">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </select>
        </div>

        {/* Unresolved List */}
        <div>
          <h2 className="text-[14px] font-semibold text-text-primary mb-3">Unresolved conflicts ({unresolved.length})</h2>
          <div className="space-y-3">
            {unresolved.map(c => {
              const bA = mockBlocks.find(b => b.id === c.blockAId)!;
              const bB = mockBlocks.find(b => b.id === c.blockBId)!;
              const severityTier = getConflictSeverityColor(c.id === "CONF-001" ? "high" : c.id === "CONF-002" ? "medium" : "low") as any;
              
              return (
                <div key={c.id} id={c.id} className="bg-surface border border-border-default relative overflow-hidden flex flex-col group">
                  <UrgencyBorder tier={severityTier} className="absolute left-0 top-0 bottom-0 pointer-events-none opacity-80 border-l-[4px]" />
                  
                  <div className="px-4 py-3 flex items-start gap-6 border-b border-border-default pl-6">
                    {/* Header/ID */}
                    <div className="w-24 shrink-0">
                      <div className="flex items-center gap-1.5 text-critical font-bold text-[13px] mb-1">
                        <AlertTriangle size={14} strokeWidth={2.5} />
                        {c.id}
                      </div>
                      <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm ${
                        severityTier === "critical" ? "bg-critical/10 text-critical" : 
                        severityTier === "warning" ? "bg-warning/10 text-warning" : "bg-caution/10 text-caution"
                      }`}>
                        {c.id === "CONF-001" ? "high" : c.id === "CONF-002" ? "medium" : "low"} severity
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      {/* Block A */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <DepartmentBadge dept={bA.department} />
                          <span className="text-[12px] font-mono font-medium text-text-primary">{bA.id}</span>
                        </div>
                        <p className="text-[12px] text-text-primary">{bA.description}</p>
                        <p className="text-[11px] text-text-secondary">Km {bA.location.kmStart}-{bA.location.kmEnd} &middot; {formatTime(bA.scheduledWindow.start)}</p>
                      </div>

                      {/* VS / Overlap */}
                      <div className="flex flex-col items-center justify-center px-4">
                        <div className="w-px h-4 bg-border-default mb-1"></div>
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest bg-canvas px-1">VS</span>
                        <div className="w-px h-4 bg-border-default mt-1"></div>
                        <p className="text-[11px] text-text-primary font-medium mt-1 text-center max-w-[120px]">{c.overlapDescription}</p>
                      </div>

                      {/* Block B */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <DepartmentBadge dept={bB.department} />
                          <span className="text-[12px] font-mono font-medium text-text-primary">{bB.id}</span>
                        </div>
                        <p className="text-[12px] text-text-primary">{bB.description}</p>
                        <p className="text-[11px] text-text-secondary">Km {bB.location.kmStart}-{bB.location.kmEnd} &middot; {formatTime(bB.scheduledWindow.start)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-2 bg-surface-sunken flex items-center justify-end gap-2 pl-6">
                    <Link href={`/plan?focus=${c.id}`} className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-border-default text-text-primary hover:bg-surface transition-colors bg-surface">
                      <Eye size={13} strokeWidth={2} /> View in chart
                    </Link>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-border-default text-text-primary hover:bg-surface transition-colors bg-surface">
                      <ArrowUpRight size={13} strokeWidth={2} /> Escalate
                    </button>
                    <button onClick={() => setPreviewAction({conflict: c, action: "Sequence"})} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium border border-border-default text-text-primary hover:bg-surface transition-colors bg-surface">
                      <ArrowRightLeft size={13} strokeWidth={2} /> Sequence
                    </button>
                    <button onClick={() => setPreviewAction({conflict: c, action: "Merge"})} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors">
                      <Merge size={13} strokeWidth={2} /> Merge into combined block
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolved List */}
        {resolved.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[14px] font-semibold text-text-primary mb-3">Recently resolved ({resolved.length})</h2>
            <div className="space-y-2 opacity-75 hover:opacity-100 transition-opacity">
              {resolved.map(c => {
                const bA = mockBlocks.find(b => b.id === c.blockAId)!;
                const bB = mockBlocks.find(b => b.id === c.blockBId)!;
                return (
                  <div key={c.id} className="bg-surface border border-border-default px-4 py-3 flex items-center gap-4">
                    <div className="w-24 text-[12px] font-mono font-medium text-text-primary line-through decoration-text-secondary/50">{c.id}</div>
                    <div className="flex-1 text-[12px] text-text-secondary truncate">
                      {bA.id} <span className="mx-1">vs</span> {bB.id}
                    </div>
                    {c.resolution && (
                      <div className="text-[11px] text-text-primary font-medium text-right flex flex-col items-end">
                        <span>{c.resolution.action} by {c.resolution.actor}</span>
                        <span className="text-text-secondary font-normal">{formatRelativeTime(c.resolution.timestamp)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
