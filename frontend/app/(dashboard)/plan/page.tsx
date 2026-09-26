"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout";
import { DateNav, BlockPlanChart, DetailPanel, ChartLegend, RegisterView } from "@/components/plan";
import { optimizeRequests } from "@/lib/api";
import type { OptimizerResponse } from "@/lib/api";
import { useDashboardData } from "@/lib/dashboard-context";
import { computeConflicts, DAY_MS, HOUR_MS, clampView } from "@/lib/chart-engine";
import type { ChartBlock, DerivedConflict } from "@/lib/types";

type ViewMode = "chart" | "register";

function formatMinute(minute: number | null | undefined) {
  if (minute === null || minute === undefined) return "--:--";
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function parseBlockTimes(startIso: string, endIso: string): { start: number; end: number } {
  const dStart = new Date(startIso);
  const dEnd = new Date(endIso);
  if (isNaN(dStart.getTime())) {
    return { start: 8 * HOUR_MS, end: 10 * HOUR_MS };
  }
  const startMs = (dStart.getHours() * 3600 + dStart.getMinutes() * 60 + dStart.getSeconds()) * 1000;
  let duration = !isNaN(dEnd.getTime()) ? dEnd.getTime() - dStart.getTime() : 2 * HOUR_MS;
  if (duration <= 0 || duration > 24 * HOUR_MS) {
    duration = 2 * HOUR_MS;
  }
  return { start: startMs, end: Math.min(DAY_MS, startMs + duration) };
}

function BlockPlanPageContent() {
  const searchParams = useSearchParams();
  const {
    data,
    optimizer,
    optimizerLoading,
    optimizerError,
    rerunOptimizer,
    currentRunId,
  } = useDashboardData();
  const { stations, trains } = data;

  // ─── State ─────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  });
  const [blocks, setBlocks] = useState<ChartBlock[]>(() => 
    data.blocks.map(b => {
      const times = parseBlockTimes(b.scheduledWindow.start, b.scheduledWindow.end);
      return {
        id: b.id,
        department: b.department,
        km_start: b.location.kmStart,
        km_end: b.location.kmEnd,
        time_start: times.start,
        time_end: times.end,
        status: b.status.toLowerCase(),
        isShadow: false,
        label: b.description,
        priorityTier: b.urgency.tier === "critical" ? "P1-critical" : "P4-low"
      } as ChartBlock;
    })
  );
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(DAY_MS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"block" | "train" | "conflict" | null>(null);
  const [stationFilter, setStationFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [nowMs, setNowMs] = useState(() => {
    const d = new Date();
    return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000;
  });

  // Filter proposals strictly to active run
  const activeProposals = useMemo(() => {
    if (currentRunId) {
      return data.proposals.filter((p) => p.run_id === currentRunId);
    }
    // If currentRunId is not set, take the most recent run_id
    if (data.proposals.length > 0) {
      const latestRunId = data.proposals[0].run_id;
      return data.proposals.filter((p) => p.run_id === latestRunId);
    }
    return [];
  }, [currentRunId, data.proposals]);

  // Sync selectedDate with active run's proposal date ONLY when the active run changes
  const lastSyncedRunRef = useRef<string | null>(null);
  useEffect(() => {
    const runKey = currentRunId || (activeProposals.length > 0 ? activeProposals[0].run_id : null);
    if (!runKey) return;
    if (runKey !== lastSyncedRunRef.current) {
      lastSyncedRunRef.current = runKey;
      if (activeProposals.length > 0 && activeProposals[0].proposed_start_time) {
        const d = new Date(activeProposals[0].proposed_start_time);
        if (!isNaN(d.getTime())) {
          const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
          setSelectedDate(formatted);
        }
      }
    }
  }, [currentRunId, activeProposals]);

  const proposalBlocks = useMemo<ChartBlock[]>(() => {
    if (activeProposals.length === 0) return [];
    return activeProposals.map((prop) => {
      const times = parseBlockTimes(prop.proposed_start_time, prop.proposed_end_time);
      const constituent = data.blocks.filter((b) => (prop.maintenance_request_ids || []).includes(b.id));

      // Authoritative geographic boundary from section topology
      const sectionTopos = (data.topology || []).filter((t) => t.section_id === prop.section_id);
      const secMinKm = sectionTopos.length > 0 ? Math.min(...sectionTopos.map((t) => Math.min(t.start_km, t.end_km))) : 0;
      const secMaxKm = sectionTopos.length > 0 ? Math.max(...sectionTopos.map((t) => Math.max(t.start_km, t.end_km))) : 10;

      // Filter constituent requests whose km fall legitimately inside the section topology
      const validConstituents = constituent.filter(
        (b) => b.location.kmStart >= secMinKm && b.location.kmEnd <= secMaxKm,
      );

      let kmStart: number;
      let kmEnd: number;

      if (validConstituents.length > 0) {
        kmStart = Math.min(...validConstituents.map((b) => b.location.kmStart));
        kmEnd = Math.max(...validConstituents.map((b) => b.location.kmEnd));
      } else {
        // If constituent request coordinates conflict with the proposal section,
        // place it authoritatively within its section topology boundary:
        kmStart = secMinKm;
        kmEnd = Math.min(secMaxKm, secMinKm + Math.max(2.0, (secMaxKm - secMinKm) * 0.25));
      }

      // Ensure positive span within section boundaries
      if (kmEnd <= kmStart) {
        kmEnd = Math.min(secMaxKm, kmStart + 1.0);
      }

      const dept = (prop.departments?.[0] as any) || constituent[0]?.department || "Engg";

      return {
        id: prop.id,
        department: dept,
        km_start: kmStart,
        km_end: kmEnd,
        time_start: times.start,
        time_end: times.end,
        status: prop.status.toLowerCase(),
        isShadow: false,
        label: `Proposal ${prop.id.slice(0, 8)} (${prop.section_id})`,
        priorityTier: prop.has_blocking_conflicts ? "P1-critical" : "P2-high",
      };
    });
  }, [activeProposals, data.blocks, data.topology]);

  // If an active run is established or proposals are present, stay strictly scoped to proposalBlocks.
  // Only fall back to raw maintenance requests if no active run has ever been initiated and no proposals exist.
  const planBlocks = (currentRunId || data.proposals.length > 0) ? proposalBlocks : blocks;
  const displayTrains = useMemo(() => {
    const selected = optimizer?.selected_blocks[0];
    const start = (selected?.scheduled_start_minute ?? -1) * 60_000;
    const end = (selected?.scheduled_end_minute ?? -1) * 60_000;
    return trains.map((train) => ({
      ...train,
      status: train.stops.some((stop) => stop.time >= start && stop.time <= end) ? "diverted" as const : "scheduled" as const,
    }));
  }, [optimizer, trains]);

  const conflicts: DerivedConflict[] = useMemo(
    () => computeConflicts(planBlocks, displayTrains),
    [displayTrains, planBlocks]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks(data.blocks.map(b => {
      const times = parseBlockTimes(b.scheduledWindow.start, b.scheduledWindow.end);
      return {
        id: b.id,
        department: b.department,
        km_start: b.location.kmStart,
        km_end: b.location.kmEnd,
        time_start: times.start,
        time_end: times.end,
        status: b.status.toLowerCase(),
        isShadow: false,
        label: b.description,
        priorityTier: b.urgency.tier === "critical" ? "P1-critical" : "P4-low",
      };
    }));
  }, [data.blocks]);

  // ─── NOW line — recompute every 30 seconds ─────────────
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMs((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // ─── URL deep-link on mount ────────────────────────────
  const handledFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) return;
    if (handledFocusRef.current === focus) return;

    // Find the element
    const block = planBlocks.find(b => b.id === focus);
    const train = displayTrains.find(t => t.id === focus);
    const conflict = conflicts.find(c => c.id === focus);

    if (block) {
      handledFocusRef.current = focus;
      setSelectedId(block.id);
      setSelectedType("block");
      // Center view on the block
      const mid = (block.time_start + block.time_end) / 2;
      const range = Math.max(4 * HOUR_MS, (block.time_end - block.time_start) * 3);
      const [s, e] = clampView(mid - range / 2, mid + range / 2);
      setViewStart(s);
      setViewEnd(e);
      setViewMode("chart");
    } else if (train) {
      handledFocusRef.current = focus;
      setSelectedId(train.id);
      setSelectedType("train");
      const firstTime = train.stops[0]?.time ?? 0;
      const lastTime = train.stops[train.stops.length - 1]?.time ?? DAY_MS;
      const mid = (firstTime + lastTime) / 2;
      const range = Math.max(4 * HOUR_MS, (lastTime - firstTime) * 3);
      const [s, e] = clampView(mid - range / 2, mid + range / 2);
      setViewStart(s);
      setViewEnd(e);
      setViewMode("chart");
    } else if (conflict) {
      handledFocusRef.current = focus;
      setSelectedId(conflict.id);
      setSelectedType("conflict");
      const mid = conflict.intersectionTime;
      const [s, e] = clampView(mid - 2 * HOUR_MS, mid + 2 * HOUR_MS);
      setViewStart(s);
      setViewEnd(e);
      setViewMode("chart");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts, displayTrains, planBlocks, searchParams]);

  // ─── Callbacks ─────────────────────────────────────────
  const handleViewChange = useCallback((s: number, e: number) => {
    setViewStart(s);
    setViewEnd(e);
  }, []);

  const handleSelect = useCallback((id: string, type: "block" | "train" | "conflict") => {
    setSelectedId(id);
    setSelectedType(type);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedType(null);
  }, []);

  const handleApplyResolution = useCallback((conflictId: string, resIdx: number) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    if (conflict.trainId) {
      // Train vs Block
      if (resIdx === 1) {
        // Reschedule block after train passes
        setBlocks(prev => prev.map(b => {
          if (b.id === conflict.blockId) {
            const shift = conflict.overlapMinutes * 60_000 + 10 * 60_000; // shift beyond overlap
            return { ...b, time_start: b.time_start + shift, time_end: b.time_end + shift };
          }
          return b;
        }));
      }
    } else if (conflict.otherBlockId) {
      // Block vs Block
      if (resIdx === 0) {
        // Stagger: shift block B to start after block A
        setBlocks(prev => prev.map(b => {
          if (b.id === conflict.otherBlockId) {
            const shift = (conflict.time_end - b.time_start) + 5 * 60_000; // shift 5 mins after A ends
            return { ...b, time_start: b.time_start + shift, time_end: b.time_end + shift };
          }
          return b;
        }));
      } else if (resIdx === 1) {
        // Merge: expand A to cover B, and remove B (or mark cancelled)
        setBlocks(prev => {
          const blockB = prev.find(b => b.id === conflict.otherBlockId);
          if (!blockB) return prev;
          return prev.map(b => {
            if (b.id === conflict.blockId) {
              return { 
                ...b, 
                time_start: Math.min(b.time_start, blockB.time_start), 
                time_end: Math.max(b.time_end, blockB.time_end),
                km_start: Math.min(b.km_start, blockB.km_start),
                km_end: Math.max(b.km_end, blockB.km_end)
              };
            }
            if (b.id === conflict.otherBlockId) {
              return { ...b, status: "rejected" as const };
            }
            return b;
          });
        });
      } else if (resIdx === 2) {
        // Cancel lower priority block
        setBlocks(prev => {
          const bA = prev.find(b => b.id === conflict.blockId);
          const bB = prev.find(b => b.id === conflict.otherBlockId);
          if (!bA || !bB) return prev;
          const cancelId = (bA.priorityTier > bB.priorityTier) ? bA.id : bB.id; // basic string compare works for P1 vs P2
          return prev.map(b => b.id === cancelId ? { ...b, status: "rejected" as const } : b);
        });
      }
    }
  }, [conflicts]);

  const handleSendForApproval = useCallback((conflictId: string, resIdx: number) => {
    // First apply the change
    handleApplyResolution(conflictId, resIdx);
    // Then set the affected block(s) to "proposed" status so they can be approved later
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    setBlocks(prev => prev.map(b => {
      if (b.id === conflict.blockId || b.id === conflict.otherBlockId) {
        return { ...b, status: "proposed" as const };
      }
      return b;
    }));
    handleClose(); // Close the panel after submitting
  }, [conflicts, handleApplyResolution, handleClose]);

  const handleFocusElement = useCallback((id: string, type: "block" | "train" | "conflict") => {
    setViewMode("chart");
    handleSelect(id, type);

    // Center view
    const block = planBlocks.find(b => b.id === id);
    const train = displayTrains.find(t => t.id === id);
    const conflict = conflicts.find(c => c.id === id);

    let mid = DAY_MS / 2;
    if (block) mid = (block.time_start + block.time_end) / 2;
    else if (train) {
      const firstTime = train.stops[0]?.time ?? 0;
      const lastTime = train.stops[train.stops.length - 1]?.time ?? DAY_MS;
      mid = (firstTime + lastTime) / 2;
    }
    else if (conflict) mid = conflict.intersectionTime;

    const [s, e] = clampView(mid - 3 * HOUR_MS, mid + 3 * HOUR_MS);
    setViewStart(s);
    setViewEnd(e);
  }, [conflicts, displayTrains, handleSelect, planBlocks]);

  const handleRunOptimizer = useCallback(() => {
    // Run optimizer for pending requests, prioritizing active section and adhering to CP-SAT 32 limit per section
    const activeSection = activeProposals[0]?.section_id;
    const pendingBlocks = data.blocks.filter(
      (b) => b.status === "Under review" || b.status === "Submitted"
    );
    const bySection: Record<string, string[]> = {};
    const batchedIds: string[] = [];

    // Prioritize active section requests first
    const sorted = [...pendingBlocks].sort((a, b) => {
      const aMatch = activeSection && (a.description.includes(activeSection) || (a as any).section_id === activeSection) ? 1 : 0;
      const bMatch = activeSection && (b.description.includes(activeSection) || (b as any).section_id === activeSection) ? 1 : 0;
      return bMatch - aMatch;
    });

    for (const b of sorted) {
      const sec = (b as any).section_id || (activeSection && b.description.includes(activeSection) ? activeSection : "DEFAULT");
      bySection[sec] = bySection[sec] || [];
      if (bySection[sec].length < 32) {
        bySection[sec].push(b.id);
        batchedIds.push(b.id);
      }
    }
    rerunOptimizer(batchedIds.length > 0 ? batchedIds : undefined);
  }, [activeProposals, data.blocks, rerunOptimizer]);

  // Chart width estimation for responsive detail panel layout
  const chartWidthEst = typeof window !== "undefined" ? Math.max(600, window.innerWidth - 210 - 110 - (selectedId ? 320 : 0)) : 900;

  return (
    <>
      <TopBar
        title="Block plan"
        subtitle={`Section: Chennai division — all departments • ${selectedDate}`}
      />

      {optimizerLoading && (
        <div className="bg-brand/10 border-b border-brand px-4 py-2 text-[12.5px] font-medium text-brand flex items-center justify-center gap-2 animate-pulse">
          <div className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          CP-SAT Optimizer synchronizing authoritative block proposals...
        </div>
      )}

      {optimizerError && (
        <div className="border-b border-critical bg-critical/10 px-4 py-2 text-[12px] text-critical">
          Optimizer notice: {optimizerError}
        </div>
      )}

      {(activeProposals.length > 0 || currentRunId || optimizer) && !optimizerLoading && (
        <div className="grid grid-cols-4 gap-px bg-border-default border-b border-border-default text-[12px]">
          <div className="bg-surface px-4 py-2">
            <span className="text-text-secondary">Proposals ({currentRunId ? `Run ${currentRunId.slice(0, 8)}` : "Active"})</span>
            <strong className="num ml-2">{activeProposals.length}</strong>
          </div>
          <div className="bg-surface px-4 py-2">
            <span className="text-text-secondary">Possession saving</span>
            <strong className="num ml-2">
              {activeProposals.reduce((sum, p) => sum + (p.possession_saving_minutes || 0), 0).toFixed(1)} min
            </strong>
          </div>
          <div className="bg-surface px-4 py-2">
            <span className="text-text-secondary">Active section</span>
            <strong className="num ml-2">{activeProposals[0]?.section_id || "Corridor"}</strong>
          </div>
          <div className="bg-surface px-4 py-2">
            <span className="text-text-secondary">Blocking conflicts</span>
            <strong className="num ml-2 text-critical">
              {activeProposals.reduce((sum, p) => sum + (p.blocking_conflict_count || 0), 0)}
            </strong>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-canvas">
        {/* ─── Toolbar ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-surface shrink-0 flex-wrap">
          {/* View toggle: Chart / Register */}
          <div className="flex bg-surface-sunken border border-border-default">
            {(["chart", "register"] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors capitalize ${
                  viewMode === mode ? "bg-brand text-white" : "text-text-secondary hover:text-text-primary hover:bg-surface"
                }`}>
                {mode}
              </button>
            ))}
          </div>

          <DateNav
            currentDate={selectedDate}
            onDateChange={setSelectedDate}
          />

          <button
            onClick={handleRunOptimizer}
            disabled={optimizerLoading}
            className="px-2.5 py-1 text-[11.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {optimizerLoading ? "Optimizing..." : "Run CP-SAT Optimizer"}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => {
              const range = viewEnd - viewStart;
              const shift = range * 0.25;
              const [s, e] = clampView(viewStart - shift, viewEnd - shift);
              setViewStart(s); setViewEnd(e);
            }} className="px-2 py-1 text-[11px] border border-border-default text-text-secondary hover:bg-surface-sunken font-medium" title="Move earlier">
              &lt;
            </button>
            <button onClick={() => {
              const range = viewEnd - viewStart;
              const shift = range * 0.25;
              const [s, e] = clampView(viewStart + shift, viewEnd + shift);
              setViewStart(s); setViewEnd(e);
            }} className="px-2 py-1 text-[11px] border border-border-default text-text-secondary hover:bg-surface-sunken font-medium mr-2" title="Move later">
              &gt;
            </button>
            <button onClick={() => {
              const mid = (viewStart + viewEnd) / 2;
              const range = (viewEnd - viewStart) * 0.6;
              const [s, e] = clampView(mid - range / 2, mid + range / 2);
              setViewStart(s); setViewEnd(e);
            }} className="px-2 py-1 text-[11px] border border-border-default text-text-secondary hover:bg-surface-sunken font-medium">
              Zoom +
            </button>
            <button onClick={() => {
              const mid = (viewStart + viewEnd) / 2;
              const range = (viewEnd - viewStart) * 1.5;
              const [s, e] = clampView(mid - range / 2, mid + range / 2);
              setViewStart(s); setViewEnd(e);
            }} className="px-2 py-1 text-[11px] border border-border-default text-text-secondary hover:bg-surface-sunken font-medium">
              Zoom −
            </button>
            <button onClick={() => { setViewStart(0); setViewEnd(DAY_MS); }}
              className="px-2 py-1 text-[11px] border border-border-default text-text-secondary hover:bg-surface-sunken font-medium">
              Full day
            </button>
          </div>

          {stationFilter && (
            <button onClick={() => setStationFilter(null)}
              className="text-[11px] text-brand font-medium hover:underline">
              Clear station filter
            </button>
          )}
        </div>

        {/* ─── Main area: Chart/Register + Detail Panel ────── */}
        <div className="flex-1 flex min-h-0">
          {viewMode === "chart" ? (
            <div className="flex-1 min-w-0 h-full p-3">
              <BlockPlanChart
                stations={stations}
                blocks={planBlocks}
                trains={displayTrains}
                conflicts={conflicts}
                viewStart={viewStart}
                viewEnd={viewEnd}
                onViewChange={handleViewChange}
                selectedId={selectedId}
                onSelect={handleSelect}
                stationFilter={stationFilter}
                onStationFilter={setStationFilter}
                nowMs={nowMs}
              />
            </div>
          ) : (
            <RegisterView
              blocks={planBlocks}
              trains={displayTrains}
              conflicts={conflicts}
              onFocusElement={handleFocusElement}
            />
          )}

          {/* Detail Panel */}
          {selectedId && selectedType && (
            <DetailPanel
              selectedId={selectedId}
              selectedType={selectedType}
              blocks={planBlocks}
              trains={displayTrains}
              conflicts={conflicts}
              stations={stations}
              onClose={handleClose}
              onApplyResolution={handleApplyResolution}
              onSendForApproval={handleSendForApproval}
              onSelectConflict={(id) => handleSelect(id, "conflict")}
            />
          )}
        </div>

        {/* ─── Legend (always visible, no scroll needed) ────── */}
        <ChartLegend />
      </div>
    </>
  );
}

export default function BlockPlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-secondary">Loading plan data...</div>}>
      <BlockPlanPageContent />
    </Suspense>
  );
}
