"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout";
import { DateNav, BlockPlanChart, DetailPanel, ChartLegend, RegisterView } from "@/components/plan";
import { mockStations, mockTrainPaths } from "@/lib/mock-data";
import { fetchBlocks, fetchConflicts } from "@/lib/api-client";
import { useLiveSync } from "@/hooks/useLiveSync";
import { computeConflicts, DAY_MS, HOUR_MS, clampView } from "@/lib/chart-engine";
import type { ChartBlock, DerivedConflict } from "@/lib/types";

type ViewMode = "chart" | "register";

function BlockPlanPageContent() {
  const searchParams = useSearchParams();

  // ─── State ─────────────────────────────────────────────
  const [blocks, setBlocks] = useState<ChartBlock[]>([]);
  const [conflicts, setConflicts] = useState<DerivedConflict[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
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

  // Fetch initial data
  const loadData = useCallback(async () => {
    try {
      const [blocksData, conflictsData] = await Promise.all([
        fetchBlocks(),
        fetchConflicts()
      ]);
      
      setBlocks(blocksData.map((b: any) => ({
        id: b.id,
        department: b.department,
        category: b.category,
        description: b.description,
        label: b.description,
        km_start: b.location.kmStart,
        km_end: b.location.kmEnd,
        time_start: new Date(b.scheduledWindow.start).getTime() - new Date().setHours(0,0,0,0),
        time_end: new Date(b.scheduledWindow.end).getTime() - new Date().setHours(0,0,0,0),
        status: b.status.toLowerCase(),
        priorityTier: b.urgency?.tier || "routine",
        isShadow: false,
      })));
      
      setConflicts(conflictsData.map((c: any) => ({
        id: c.id,
        blockId: c.blockAId,
        otherBlockId: c.blockBId,
        trainId: c.trainId,
        km_start: 0, // Simplified for demo
        km_end: 0,
        time_start: new Date(c.windowStart).getTime() - new Date().setHours(0,0,0,0),
        time_end: new Date(c.windowStart).getTime() - new Date().setHours(0,0,0,0) + 3600000,
        overlapMinutes: 60,
        intersectionKm: 240,
        intersectionTime: new Date(c.windowStart).getTime() - new Date().setHours(0,0,0,0),
        priorityTier: "critical",
        affectedBlockDesc: c.overlapDescription,
        candidate_resolutions: c.resolution ? [c.resolution.action] : []
      })));
    } catch (e) {
      console.error("Failed to fetch", e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle live updates
  const { lastSynced, status: syncStatus } = useLiveSync(useCallback((type: string, payload: any) => {
    console.log("Live update:", type, payload);
    // Reload everything on any change for simplicity in this demo
    loadData();
  }, [loadData]));

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
    const block = blocks.find(b => b.id === focus);
    const train = mockTrainPaths.find(t => t.id === focus);
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
  }, []);

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
    const block = blocks.find(b => b.id === id);
    const train = mockTrainPaths.find(t => t.id === id);
    const conflict = conflicts.find(c => c.id === id);

    let mid = DAY_MS / 2;
    if (block) mid = (block.time_start + block.time_end) / 2;
    else if (train) mid = (train.stops[0]?.time ?? 0 + (train.stops[train.stops.length - 1]?.time ?? DAY_MS)) / 2;
    else if (conflict) mid = conflict.intersectionTime;

    const [s, e] = clampView(mid - 3 * HOUR_MS, mid + 3 * HOUR_MS);
    setViewStart(s);
    setViewEnd(e);
  }, [blocks, conflicts, handleSelect]);

  // Chart width estimation for responsive detail panel layout
  const chartWidthEst = typeof window !== "undefined" ? Math.max(600, window.innerWidth - 210 - 110 - (selectedId ? 320 : 0)) : 900;

  return (
    <>
      <TopBar
        title="Block plan"
        subtitle="Section: Ambala Cantt–Saharanpur — all departments"
      />

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
            <div className="flex-1 min-w-0 p-3 bg-surface rounded-xl border border-white/5 relative overflow-hidden flex flex-col shadow-inner">
              {isMounted && (
                <BlockPlanChart
                  stations={mockStations}
                  blocks={blocks}
                  trains={mockTrainPaths}
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
              )}
            </div>
          ) : (
            <RegisterView
              blocks={blocks}
              trains={mockTrainPaths}
              conflicts={conflicts}
              onFocusElement={handleFocusElement}
            />
          )}

          {/* Detail Panel */}
          {selectedId && selectedType && (
            <DetailPanel
              selectedId={selectedId}
              selectedType={selectedType}
              blocks={blocks}
              trains={mockTrainPaths}
              conflicts={conflicts}
              stations={mockStations}
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
