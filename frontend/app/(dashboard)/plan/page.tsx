"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
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

function BlockPlanPageContent() {
  const searchParams = useSearchParams();
  const { data } = useDashboardData();
  const { stations, trains } = data;
  const [optimization, setOptimization] = useState<OptimizerResponse | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  // ─── State ─────────────────────────────────────────────
  const [blocks, setBlocks] = useState<ChartBlock[]>(() => 
    data.blocks.map(b => ({
      id: b.id,
      department: b.department,
      km_start: b.location.kmStart,
      km_end: b.location.kmEnd,
      time_start: new Date(b.scheduledWindow.start).getTime() - new Date().setHours(0,0,0,0),
      time_end: new Date(b.scheduledWindow.end).getTime() - new Date().setHours(0,0,0,0),
      status: b.status.toLowerCase(),
      isShadow: false,
      label: b.description,
      priorityTier: b.urgency.tier === "critical" ? "P1-critical" : "P4-low"
    }) as ChartBlock)
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

  useEffect(() => {
    const requestIds = data.blocks.map((block) => block.id);
    if (requestIds.length === 0) return;
    let active = true;
    optimizeRequests(requestIds)
      .then((result) => {
        if (active) setOptimization(result);
      })
      .catch((reason: unknown) => {
        if (active) setOptimizationError(reason instanceof Error ? reason.message : "Unable to optimize the live block plan");
      });
    return () => {
      active = false;
    };
  }, [data.blocks]);

  // ─── Derived conflicts (computed, never stored) ─────────
  const optimizedBlocks = useMemo<ChartBlock[]>(() => {
    if (!optimization) return [];
    const today = new Date().setHours(0, 0, 0, 0);
    return optimization.selected_blocks.map((candidate, index) => {
      const members = blocks.filter((block) => candidate.request_ids.includes(block.id));
      const first = members[0];
      const start = (candidate.scheduled_start_minute ?? 0) * 60_000;
      const end = (candidate.scheduled_end_minute ?? (candidate.scheduled_start_minute ?? 0) + candidate.predicted_duration_minutes) * 60_000;
      return {
        id: `OPT-${candidate.section_id}-${index + 1}`,
        department: first?.department ?? "Engg",
        km_start: Math.min(...members.map((member) => member.km_start)),
        km_end: Math.max(...members.map((member) => member.km_end)),
        time_start: start,
        time_end: end,
        status: "approved",
        isShadow: false,
        label: `Optimized possession (${candidate.request_ids.length} requests)`,
        priorityTier: candidate.urgency_level === "high" ? "P1-critical" : "P2-high",
        candidate,
        today,
      };
    });
  }, [blocks, optimization]);

  const planBlocks = optimizedBlocks.length > 0 ? optimizedBlocks : blocks;
  const displayTrains = useMemo(() => {
    const selected = optimization?.selected_blocks[0];
    const start = (selected?.scheduled_start_minute ?? -1) * 60_000;
    const end = (selected?.scheduled_end_minute ?? -1) * 60_000;
    return trains.map((train) => ({
      ...train,
      status: train.stops.some((stop) => stop.time >= start && stop.time <= end) ? "diverted" as const : "scheduled" as const,
    }));
  }, [optimization, trains]);

  const conflicts: DerivedConflict[] = useMemo(
    () => computeConflicts(planBlocks, displayTrains),
    [displayTrains, planBlocks]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks(data.blocks.map(b => ({
      id: b.id,
      department: b.department,
      km_start: b.location.kmStart,
      km_end: b.location.kmEnd,
      time_start: new Date(b.scheduledWindow.start).getTime() - new Date().setHours(0, 0, 0, 0),
      time_end: new Date(b.scheduledWindow.end).getTime() - new Date().setHours(0, 0, 0, 0),
      status: b.status.toLowerCase(),
      isShadow: false,
      label: b.description,
      priorityTier: b.urgency.tier === "critical" ? "P1-critical" : "P4-low",
    })));
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
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) return;

    // Find the element
    const block = planBlocks.find(b => b.id === focus);
    const train = displayTrains.find(t => t.id === focus);
    const conflict = conflicts.find(c => c.id === focus);

    if (block) {
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

  const handleApproveBlock = useCallback((blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      if (b.status === "proposed") return { ...b, status: "approved" as const };
      if (b.status === "approved") return { ...b, status: "active" as const };
      return b;
    }));
  }, []);

  const handleApplyResolution = useCallback((conflictId: string, _resIdx: number) => {
    // For demo: remove the conflicting block or shift it
    // In production this would call the API
    console.log(`Applied resolution ${_resIdx} for ${conflictId}`);
  }, []);

  const handleFocusElement = useCallback((id: string, type: "block" | "train" | "conflict") => {
    setViewMode("chart");
    handleSelect(id, type);

    // Center view
    const block = planBlocks.find(b => b.id === id);
    const train = displayTrains.find(t => t.id === id);
    const conflict = conflicts.find(c => c.id === id);

    let mid = DAY_MS / 2;
    if (block) mid = (block.time_start + block.time_end) / 2;
    else if (train) mid = (train.stops[0]?.time ?? 0 + (train.stops[train.stops.length - 1]?.time ?? DAY_MS)) / 2;
    else if (conflict) mid = conflict.intersectionTime;

    const [s, e] = clampView(mid - 3 * HOUR_MS, mid + 3 * HOUR_MS);
    setViewStart(s);
    setViewEnd(e);
  }, [conflicts, displayTrains, handleSelect, planBlocks]);

  // Chart width estimation for responsive detail panel layout
  const chartWidthEst = typeof window !== "undefined" ? Math.max(600, window.innerWidth - 210 - 110 - (selectedId ? 320 : 0)) : 900;

  return (
    <>
      <TopBar
        title="Block plan"
        subtitle="Section: Chennai division — all departments"
      />

      {optimizationError && <div className="border-b border-critical bg-critical/10 px-4 py-2 text-[12px] text-critical">Optimizer unavailable: {optimizationError}</div>}
      {optimization && (
        <div className="grid grid-cols-4 gap-px bg-border-default border-b border-border-default text-[12px]">
          <div className="bg-surface px-4 py-2"><span className="text-text-secondary">Optimized blocks</span><strong className="num ml-2">{optimization.totals.optimized_block_count}</strong></div>
          <div className="bg-surface px-4 py-2"><span className="text-text-secondary">Possession saving</span><strong className="num ml-2">{Number(optimization.totals.possession_saving_minutes).toFixed(1)} min</strong></div>
          <div className="bg-surface px-4 py-2"><span className="text-text-secondary">Scheduled window</span><strong className="num ml-2">{formatMinute(optimization.selected_blocks[0]?.scheduled_start_minute)} - {formatMinute(optimization.selected_blocks[0]?.scheduled_end_minute)}</strong></div>
          <div className="bg-surface px-4 py-2"><span className="text-text-secondary">Train impact</span><strong className="num ml-2">{Math.round(optimization.selected_blocks[0]?.train_impact_minutes ?? 0)} min</strong></div>
          <div className="bg-surface px-4 py-2"><span className="text-text-secondary">Train routing</span><strong className="ml-2">{displayTrains.filter((train) => train.status === "diverted").length} diverted / {displayTrains.filter((train) => train.status === "scheduled").length} scheduled</strong></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-canvas">
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

          <DateNav currentDate="05 Sep 2026" onPrev={() => {}} onNext={() => {}} />

          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-auto">
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
            <div className="flex-1 min-w-0 p-3">
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
              onApproveBlock={handleApproveBlock}
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
