"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout";
import { DateNav, BlockPlanChart, DetailPanel, ChartLegend, RegisterView } from "@/components/plan";
import { optimizeRequests } from "@/lib/api";
import type { OptimizerResponse } from "@/lib/api";
import { useDashboardData } from "@/lib/dashboard-context";
import { computeConflicts, DAY_MS, HOUR_MS, clampView } from "@/lib/chart-engine";
import { getShortProposalId } from "@/components/approvals/approval-utils";
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
    data.blocks.filter(b => {
      const d = new Date(b.scheduledWindow.start);
      if (isNaN(d.getTime())) return true;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) === selectedDate;
    }).map(b => {
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
        label: b.id,
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

  // Filter proposals strictly to active run and selected date
  const activeProposals = useMemo(() => {
    let props: typeof data.proposals = [];
    if (currentRunId) {
      props = data.proposals.filter((p) => p.run_id === currentRunId);
    } else if (data.proposals.length > 0) {
      const latestRunId = data.proposals[0].run_id;
      props = data.proposals.filter((p) => p.run_id === latestRunId);
    }
    
    return props.filter((p) => {
      if (!p.proposed_start_time) return true;
      const pd = new Date(p.proposed_start_time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      return pd === selectedDate;
    });
  }, [currentRunId, data.proposals, selectedDate]);

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
        label: getShortProposalId(prop.id),
        priorityTier: prop.has_blocking_conflicts ? "P1-critical" : "P2-high",
      };
    });
  }, [activeProposals, data.blocks, data.topology]);

  // Combine active proposals with any raw maintenance requests that haven't been optimized yet.
  const planBlocks = useMemo(() => {
    const coveredReqIds = new Set<string>();
    activeProposals.forEach(p => {
      if (p.maintenance_request_ids) {
        p.maintenance_request_ids.forEach((id: string) => coveredReqIds.add(id));
      }
    });

    const uncoveredBlocks = blocks.filter(b => !coveredReqIds.has(b.id)).map(b => ({
      ...b,
      status: "unassigned",
      isShadow: true,
      priorityTier: "P4-low" as const
    }));

    return [...proposalBlocks, ...uncoveredBlocks];
  }, [proposalBlocks, blocks, activeProposals]);
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
    setBlocks(data.blocks.filter(b => {
      const d = new Date(b.scheduledWindow.start);
      if (isNaN(d.getTime())) return true;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) === selectedDate;
    }).map(b => {
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
        label: b.id,
        priorityTier: b.urgency.tier === "critical" ? "P1-critical" : "P4-low",
      };
    }));
  }, [data.blocks, selectedDate]);

  // ─── NOW line — recompute every 30 seconds ─────────────
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMs((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // ─── Sync selectedDate with focused item date if needed ──
  useEffect(() => {
    const focus = searchParams.get("focus") || searchParams.get("request");
    if (!focus) return;

    const targetProp = data.proposals.find(
      (p) => p.id === focus || (p.maintenance_request_ids && p.maintenance_request_ids.includes(focus)),
    );
    if (targetProp && targetProp.proposed_start_time) {
      const d = new Date(targetProp.proposed_start_time);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        setSelectedDate(formatted);
        return;
      }
    }

    const targetReq = data.blocks.find((b) => b.id === focus);
    if (targetReq && targetReq.scheduledWindow?.start) {
      const d = new Date(targetReq.scheduledWindow.start);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        setSelectedDate(formatted);
      }
    }
  }, [searchParams, data.proposals, data.blocks]);

  // ─── Handle batch requests planning param ───────────────
  const handledRequestsRef = useRef<string | null>(null);
  useEffect(() => {
    const reqsParam = searchParams.get("requests");
    if (!reqsParam || handledRequestsRef.current === reqsParam) return;
    handledRequestsRef.current = reqsParam;
    const reqIds = reqsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (reqIds.length > 0) {
      rerunOptimizer(reqIds);
    }
  }, [searchParams, rerunOptimizer]);

  // ─── URL deep-link on mount ────────────────────────────
  const handledFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const focus = searchParams.get("focus") || searchParams.get("request");
    if (!focus) return;
    if (handledFocusRef.current === focus) return;

    // Check if there is an active proposal or constituent request matching
    const matchingProp = activeProposals.find(
      (p) => p.id === focus || (p.maintenance_request_ids && p.maintenance_request_ids.includes(focus)),
    );
    const targetId = matchingProp ? matchingProp.id : focus;

    // Find the element
    const block = planBlocks.find((b) => b.id === targetId || b.id === focus);
    const train = displayTrains.find((t) => t.id === focus);
    const conflict = conflicts.find((c) => c.id === focus);

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
  }, [conflicts, displayTrains, planBlocks, searchParams, activeProposals]);

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
        <div className="shrink-0 px-6 pt-5 bg-canvas">
          <div className="grid grid-cols-4 gap-5">
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-border-default flex flex-col justify-between">
              <span className="text-[12.5px] font-bold text-text-secondary uppercase tracking-wider">Proposals {currentRunId ? `(Run ${currentRunId.slice(0, 8)})` : "(Active)"}</span>
              <strong className="text-[32px] font-black num mt-2 tracking-tight text-text-primary">{activeProposals.length}</strong>
            </div>
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-border-default flex flex-col justify-between">
              <span className="text-[12.5px] font-bold text-text-secondary uppercase tracking-wider">Possession saving</span>
              <strong className="text-[32px] font-black num mt-2 tracking-tight text-positive">
                {activeProposals.reduce((sum, p) => sum + (p.possession_saving_minutes || 0), 0).toFixed(0)} <span className="text-[16px] font-semibold text-text-secondary tracking-normal">min</span>
              </strong>
            </div>
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-border-default flex flex-col justify-between">
              <span className="text-[12.5px] font-bold text-text-secondary uppercase tracking-wider">Active section</span>
              <strong className="text-[24px] font-black mt-3 tracking-tight text-text-primary truncate">{activeProposals[0]?.section_id || "Corridor"}</strong>
            </div>
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-border-default flex flex-col justify-between">
              <span className="text-[12.5px] font-bold text-text-secondary uppercase tracking-wider">Blocking conflicts</span>
              <strong className="text-[32px] font-black num mt-2 tracking-tight text-critical">
                {activeProposals.reduce((sum, p) => sum + (p.blocking_conflict_count || 0), 0)}
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-canvas">
        {/* ─── Toolbar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-canvas shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex bg-surface-sunken p-1 rounded-lg border border-border-default shadow-xs">
              {(["chart", "register"] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 text-[12px] font-bold transition-all capitalize rounded-md ${
                    viewMode === mode ? "bg-surface text-brand shadow-sm" : "text-text-secondary hover:text-text-primary hover:bg-surface"
                  }`}>
                  {mode}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-border-default" />

            <div className="scale-95 origin-left">
              <DateNav
                currentDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>

            <div className="h-6 w-px bg-border-default" />

            <button
              onClick={handleRunOptimizer}
              disabled={optimizerLoading}
              className="px-4 py-2.5 text-[12px] font-bold bg-brand text-white hover:bg-brand-hover transition-all rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {optimizerLoading ? "Optimizing..." : "Run CP-SAT Optimizer"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {stationFilter && (
              <button onClick={() => setStationFilter(null)}
                className="text-[12px] text-critical font-bold hover:underline px-2 transition-all">
                Clear filter
              </button>
            )}
            <div className="flex items-center bg-surface p-1 rounded-lg border border-border-default shadow-xs">
              <button onClick={() => {
                const range = viewEnd - viewStart;
                const shift = range * 0.25;
                const [s, e] = clampView(viewStart - shift, viewEnd - shift);
                setViewStart(s); setViewEnd(e);
              }} className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-sunken rounded-md font-bold transition-all">
                &lt;
              </button>
              <button onClick={() => {
                const range = viewEnd - viewStart;
                const shift = range * 0.25;
                const [s, e] = clampView(viewStart + shift, viewEnd + shift);
                setViewStart(s); setViewEnd(e);
              }} className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-sunken rounded-md font-bold transition-all">
                &gt;
              </button>
              <div className="w-px h-4 bg-border-default mx-1" />
              <button onClick={() => {
                const mid = (viewStart + viewEnd) / 2;
                const range = (viewEnd - viewStart) * 0.6;
                const [s, e] = clampView(mid - range / 2, mid + range / 2);
                setViewStart(s); setViewEnd(e);
              }} className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-sunken rounded-md font-bold transition-all">
                Zoom +
              </button>
              <button onClick={() => {
                const mid = (viewStart + viewEnd) / 2;
                const range = (viewEnd - viewStart) * 1.5;
                const [s, e] = clampView(mid - range / 2, mid + range / 2);
                setViewStart(s); setViewEnd(e);
              }} className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-sunken rounded-md font-bold transition-all">
                Zoom −
              </button>
              <div className="w-px h-4 bg-border-default mx-1" />
              <button onClick={() => { setViewStart(0); setViewEnd(DAY_MS); }}
                className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-sunken rounded-md font-bold transition-all">
                Full day
              </button>
            </div>
          </div>
        </div>

        {/* ─── Main area: Chart/Register + Detail Panel ────── */}
        <div className="flex-1 flex min-h-0 px-6 pb-6 gap-6 bg-canvas">
          <div className="flex-1 min-w-0 h-full bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden flex flex-col">
            {viewMode === "chart" ? (
              <div className="flex-1 min-w-0 h-full p-2">
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
          </div>

          {/* Detail Panel */}
          {selectedId && selectedType && (
            <div className="w-[360px] shrink-0 bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden flex flex-col transition-all">
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
            </div>
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
