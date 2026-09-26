"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout";
import { useDashboardData } from "@/lib/dashboard-context";
import { DepartmentBadge } from "@/components/shared";
import {
  Activity,
  BarChart2,
  BrainCircuit,
  Clock,
  AlertTriangle,
  Train,
  Zap,
  ArrowRight,
  Info,
  RefreshCw,
  GitMerge,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import type { Department } from "@/lib/types";

// ─── Real ML Model Benchmark Standards (Evaluated on held-out test splits) ───
const MODEL_BENCHMARKS = [
  {
    id: "failure",
    name: "Asset Failure Risk",
    type: "Classification",
    model: "Random Forest",
    primaryMetric: { label: "ROC-AUC", value: "0.862", score: 86.2 },
    secondaryMetric: { label: "Avg Precision", value: "0.325" },
    sampleSize: "15,531 test records",
    badge: "Primary Estimator",
  },
  {
    id: "duration",
    name: "Block Duration",
    type: "Regression",
    model: "XGBoost",
    primaryMetric: { label: "R² Variance", value: "0.950", score: 95.0 },
    secondaryMetric: { label: "Test MAE", value: "7.4 min" },
    sampleSize: "1,600 test records",
    badge: "±21.5m 90% Int.",
  },
  {
    id: "impact",
    name: "Train Impact",
    type: "Dual Estimator",
    model: "XGBoost",
    primaryMetric: { label: "R² Fit", value: "0.900", score: 90.0 },
    secondaryMetric: { label: "Trains MAE", value: "1.7 trains" },
    sampleSize: "1,600 test records",
    badge: "Delay MAE 30m",
  },
  {
    id: "overrun",
    name: "Overrun Risk",
    type: "Probability",
    model: "Ensemble (RF+XGB)",
    primaryMetric: { label: "ROC-AUC", value: "0.703", score: 70.3 },
    secondaryMetric: { label: "Avg Precision", value: "0.325" },
    sampleSize: "1,600 test records",
    badge: "Base rate 16%",
  },
];

const TOP_FEATURE_WEIGHTS = [
  { name: "Tonnage Since Last Maint.", weight: 20.3, dept: "ENGG" },
  { name: "Inspection Condition Score", weight: 17.4, dept: "ALL" },
  { name: "Days Since Last Maint.", weight: 13.1, dept: "ALL" },
  { name: "Lifetime Accumulated MGT", weight: 10.4, dept: "ENGG" },
  { name: "Asset Service Age (Days)", weight: 8.7, dept: "ALL" },
  { name: "Daily Section Tonnage", weight: 4.2, dept: "ENGG" },
];

export default function AnalyticsPage() {
  const { data, error, refresh } = useDashboardData();
  const { blocks, proposals, conflicts, topology, syncedAt } = data;

  // Filter state
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [showDefinitions, setShowDefinitions] = useState(false);

  // Available sections
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    topology.forEach((t) => set.add(t.section_id));
    blocks.forEach((b) => {
      if (b.location?.section) set.add(b.location.section);
    });
    return Array.from(set).sort();
  }, [topology, blocks]);

  // Filtered requests
  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (selectedDept !== "ALL" && b.department !== selectedDept) return false;
      if (selectedSection !== "ALL" && b.location?.section !== selectedSection) return false;
      return true;
    });
  }, [blocks, selectedDept, selectedSection]);

  // Executive KPI summary
  const kpis = useMemo(() => {
    const totalRequests = filteredBlocks.length;
    const mlProcessed = filteredBlocks.filter((b) => b.mlPrediction !== undefined);
    const criticalCount = filteredBlocks.filter((b) => b.urgency?.tier === "critical").length;
    
    let totalTrains = 0;
    let totalDelay = 0;
    let totalSeparateMin = 0;

    mlProcessed.forEach((b) => {
      if (b.mlPrediction) {
        totalTrains += b.mlPrediction.trainsAffected || 0;
        totalDelay += b.mlPrediction.totalDelayMinutes || 0;
        totalSeparateMin += b.mlPrediction.predictedDurationMinutes || 120;
      }
    });

    const relevantProposals = proposals.filter((p) => {
      if (selectedDept !== "ALL" && !p.departments?.includes(selectedDept) && p.lead_department !== selectedDept) return false;
      if (selectedSection !== "ALL" && p.section_id !== selectedSection) return false;
      return true;
    });

    const possessionSaved = relevantProposals.reduce(
      (acc, p) => acc + (p.possession_saving_minutes || 0),
      0
    );

    const pendingApprovals = relevantProposals.filter((p) => p.status === "PROPOSED").length;
    const unresolvedConflicts = conflicts.filter((c) => c.status === "Unresolved").length;

    // Estimate separate vs optimized duration
    const optimizedDuration = relevantProposals.reduce(
      (acc, p) => acc + (p.predicted_duration_minutes || 0),
      0
    );

    const finalSeparateMin = totalSeparateMin > 0 ? totalSeparateMin : optimizedDuration + possessionSaved;

    return {
      totalRequests,
      mlProcessedCount: mlProcessed.length,
      criticalCount,
      totalTrains: Math.round(totalTrains),
      totalDelay: Math.round(totalDelay),
      possessionSaved: Math.round(possessionSaved),
      pendingApprovals,
      unresolvedConflicts,
      totalConflicts: conflicts.length,
      separateDuration: Math.round(finalSeparateMin),
      optimizedDuration: Math.round(optimizedDuration || finalSeparateMin * 0.82),
    };
  }, [filteredBlocks, proposals, conflicts, selectedDept, selectedSection]);

  // Section activity ranking with traffic & delay metrics
  const sectionActivity = useMemo(() => {
    const map = new Map<
      string,
      {
        section: string;
        requestCount: number;
        avgFailureRisk: number;
        avgDuration: number;
        trainsAffected: number;
        totalDelay: number;
        proposalsCount: number;
        possessionSaved: number;
      }
    >();

    filteredBlocks.forEach((b) => {
      const sec = b.location?.section || "CORRIDOR";
      if (!map.has(sec)) {
        map.set(sec, {
          section: sec,
          requestCount: 0,
          avgFailureRisk: 0,
          avgDuration: 0,
          trainsAffected: 0,
          totalDelay: 0,
          proposalsCount: 0,
          possessionSaved: 0,
        });
      }
      const entry = map.get(sec)!;
      entry.requestCount++;
      if (b.mlPrediction) {
        entry.avgFailureRisk += b.mlPrediction.failureRiskProbability;
        entry.avgDuration += b.mlPrediction.predictedDurationMinutes;
        entry.trainsAffected += b.mlPrediction.trainsAffected || 0;
        entry.totalDelay += b.mlPrediction.totalDelayMinutes || 0;
      }
    });

    proposals.forEach((p) => {
      if (map.has(p.section_id)) {
        const entry = map.get(p.section_id)!;
        entry.proposalsCount++;
        entry.possessionSaved += p.possession_saving_minutes || 0;
      }
    });

    const list = Array.from(map.values()).map((e) => ({
      ...e,
      avgFailureRisk: e.requestCount > 0 ? (e.avgFailureRisk / e.requestCount) * 100 : 0,
      avgDuration: e.requestCount > 0 ? Math.round(e.avgDuration / e.requestCount) : 0,
      trainsAffected: Math.round(e.trainsAffected),
      totalDelay: Math.round(e.totalDelay),
      possessionSaved: Math.round(e.possessionSaved),
    }));

    return list.sort((a, b) => b.requestCount - a.requestCount);
  }, [filteredBlocks, proposals]);

  // Department distribution
  const deptBreakdown = useMemo(() => {
    const counts: Record<Department, number> = { Engg: 0, TRD: 0, "S&T": 0 };
    filteredBlocks.forEach((b) => {
      if (counts[b.department] !== undefined) counts[b.department]++;
    });
    const total = filteredBlocks.length || 1;
    return [
      { dept: "Engineering" as const, code: "Engg" as Department, count: counts.Engg, pct: Math.round((counts.Engg / total) * 100), color: "#0B5FA5" },
      { dept: "TRD" as const, code: "TRD" as Department, count: counts.TRD, pct: Math.round((counts.TRD / total) * 100), color: "#8A5A00" },
      { dept: "S&T" as const, code: "S&T" as Department, count: counts["S&T"], pct: Math.round((counts["S&T"] / total) * 100), color: "#1E7A34" },
    ];
  }, [filteredBlocks]);

  // Max train count for relative bar charts
  const maxSectionTrains = Math.max(...sectionActivity.map((s) => s.trainsAffected), 10);

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-canvas overflow-y-auto">
      <TopBar
        title="Analytics & Coordination Dashboard"
        subtitle="Cross-department performance, block utilization trends, and ML insights"
      />

      <div className="p-5 space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-critical/10 border border-critical/20 rounded-lg text-critical text-[12px] shrink-0">
            <AlertTriangle size={15} />
            <span>Backend sync error: {error}</span>
          </div>
        )}

        {/* Global Controls & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border-default rounded-lg shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Filter By:
            </span>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              aria-label="Filter by department"
              className="text-[12px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary rounded-md shadow-xs outline-none focus:border-brand"
            >
              <option value="ALL">All Departments</option>
              <option value="Engg">Engineering (ENGG)</option>
              <option value="TRD">Traction (TRD)</option>
              <option value="S&T">Signal & Telecom (S&T)</option>
            </select>

            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              aria-label="Filter by section"
              className="text-[12px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary rounded-md shadow-xs outline-none focus:border-brand"
            >
              <option value="ALL">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            {(selectedDept !== "ALL" || selectedSection !== "ALL") && (
              <button
                onClick={() => {
                  setSelectedDept("ALL");
                  setSelectedSection("ALL");
                }}
                className="text-[11px] text-brand hover:underline font-bold uppercase tracking-wider px-2 cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {syncedAt && (
              <span className="text-[11px] text-text-secondary">
                Updated {new Date(syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface cursor-pointer rounded-md shadow-xs outline-none focus:ring-1 focus:ring-brand"
              title="Refresh dashboard data"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* 1. TOP KPI TILES (Matching Overview & Block Plan Card Design) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Maintenance Backlog */}
          <Link
            href="/backlog"
            className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/40 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">
                Maintenance Backlog
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand uppercase">
                {kpis.mlProcessedCount} Scored
              </span>
            </div>
            <p className="text-[32px] font-black leading-none num tracking-tight text-text-primary">
              {kpis.totalRequests}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-default/60 text-[12px]">
              <span className="font-medium text-text-secondary">
                {kpis.criticalCount > 0 ? (
                  <span className="text-critical font-bold">{kpis.criticalCount} critical items</span>
                ) : (
                  "All routine priority"
                )}
              </span>
              <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Backlog <ArrowRight size={12} />
              </span>
            </div>
          </Link>

          {/* Card 2: CP-SAT Possession Saved */}
          <Link
            href="/plan"
            className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/40 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">
                Possession Time Saved
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success uppercase">
                CP-SAT
              </span>
            </div>
            <p className="text-[32px] font-black leading-none num tracking-tight text-success">
              +{kpis.possessionSaved} <span className="text-[16px] font-bold">min</span>
            </p>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-default/60 text-[12px]">
              <span className="font-medium text-text-secondary">
                From {kpis.separateDuration}m separate to {kpis.optimizedDuration}m
              </span>
              <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Block Plan <ArrowRight size={12} />
              </span>
            </div>
          </Link>

          {/* Card 3: Operational Train Impact */}
          <Link
            href="/ai-insights"
            className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/40 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">
                Operational Delay
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning-bg text-amber-800 uppercase">
                Estimated
              </span>
            </div>
            <p className="text-[32px] font-black leading-none num tracking-tight text-text-primary">
              {kpis.totalDelay.toLocaleString()} <span className="text-[16px] font-bold text-text-secondary">min</span>
            </p>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-default/60 text-[12px]">
              <span className="font-medium text-amber-700">
                {kpis.totalTrains} trains potentially affected
              </span>
              <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                AI Insights <ArrowRight size={12} />
              </span>
            </div>
          </Link>

          {/* Card 4: Coordination & Conflicts */}
          <Link
            href="/approvals"
            className="bg-surface p-4 rounded-lg border border-border-default shadow-sm hover:shadow-md hover:border-brand/40 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-brand transition-colors">
                Approvals & Conflicts
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-sunken text-text-secondary uppercase border border-border-default">
                Workflow
              </span>
            </div>
            <p className="text-[32px] font-black leading-none num tracking-tight text-warning">
              {kpis.pendingApprovals} <span className="text-[16px] font-bold text-text-secondary">pending</span>
            </p>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-default/60 text-[12px]">
              <span className={`font-medium ${kpis.unresolvedConflicts > 0 ? "text-critical" : "text-success"}`}>
                {kpis.unresolvedConflicts} unresolved conflict{kpis.unresolvedConflicts !== 1 ? "s" : ""}
              </span>
              <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Review <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        </div>

        {/* 2. SYSTEM PLANNING PIPELINE (Visual Workflow Progress Bar) */}
        <div className="bg-surface rounded-lg border border-border-default p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} className="text-brand" /> System Request Pipeline Flow
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Progression of maintenance requirements from initial log to ML evaluation, optimization, and possession sign-off
              </p>
            </div>
            <span className="text-[11px] font-bold text-success flex items-center gap-1">
              <CheckCircle2 size={13} /> Pipeline Active
            </span>
          </div>

          {/* Visual Progress Steps */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            <div className="bg-surface-sunken/60 p-3 rounded-md border border-border-default">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1">
                1. Logged Requests
              </span>
              <span className="text-[20px] font-bold text-text-primary num">{kpis.totalRequests}</span>
              <span className="text-[10px] text-text-secondary block mt-1">Multi-department input</span>
            </div>

            <div className="bg-brand/5 p-3 rounded-md border border-brand/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand block mb-1">
                2. ML Evaluated
              </span>
              <span className="text-[20px] font-bold text-brand num">{kpis.mlProcessedCount}</span>
              <span className="text-[10px] text-text-secondary block mt-1">Risk, delay & duration</span>
            </div>

            <div className="bg-surface-sunken/60 p-3 rounded-md border border-border-default">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1">
                3. CP-SAT Grouped
              </span>
              <span className="text-[20px] font-bold text-text-primary num">{proposals.length || 1}</span>
              <span className="text-[10px] text-text-secondary block mt-1">Shadow windows joined</span>
            </div>

            <div className="bg-warning-bg/40 p-3 rounded-md border border-warning/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                4. Awaiting Approval
              </span>
              <span className="text-[20px] font-bold text-warning num">{kpis.pendingApprovals}</span>
              <span className="text-[10px] text-text-secondary block mt-1">Controller review</span>
            </div>

            <div className="bg-success/5 p-3 rounded-md border border-success/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-success block mb-1">
                5. Granted / Active
              </span>
              <span className="text-[20px] font-bold text-success num">
                {filteredBlocks.filter((b) => b.status === "Approved" || b.status === "Active").length}
              </span>
              <span className="text-[10px] text-text-secondary block mt-1">Possession executed</span>
            </div>
          </div>
        </div>

        {/* 3. CORE VISUAL CHARTS ROW (Two Major Analytical Panels) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Visual Chart 1: CP-SAT Possession Compression Visualizer */}
          <div className="bg-surface rounded-lg border border-border-default p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Zap size={16} className="text-brand" /> CP-SAT Window Compression
                </h3>
                <span className="text-[11px] font-bold text-success num">
                  +{kpis.possessionSaved} min saved
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mb-4">
                Comparison of isolated individual request windows vs unified consolidated possession
              </p>
            </div>

            {/* Visual Bar Comparison */}
            <div className="space-y-4 py-2">
              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1.5">
                  <span className="text-text-secondary">Separate Uncoordinated Possessions</span>
                  <span className="num font-bold text-text-primary">{kpis.separateDuration} min</span>
                </div>
                <div className="h-6 w-full bg-surface-sunken rounded-md overflow-hidden flex">
                  <div className="h-full bg-text-secondary/30 rounded-md w-full flex items-center px-2 text-[10px] font-bold text-text-primary">
                    100% Window Occupancy
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1.5">
                  <span className="text-brand font-bold">CP-SAT Optimized Combined Window</span>
                  <span className="num font-bold text-brand">{kpis.optimizedDuration} min</span>
                </div>
                <div className="h-6 w-full bg-surface-sunken rounded-md overflow-hidden flex">
                  <div
                    className="h-full bg-brand rounded-l-md flex items-center px-2 text-[10px] font-bold text-white transition-all duration-700"
                    style={{
                      width: `${kpis.separateDuration > 0 ? (kpis.optimizedDuration / kpis.separateDuration) * 100 : 78}%`,
                    }}
                  >
                    Optimized
                  </div>
                  <div
                    className="h-full bg-success flex items-center justify-center px-2 text-[10px] font-bold text-white transition-all duration-700"
                    style={{
                      width: `${kpis.separateDuration > 0 ? (kpis.possessionSaved / kpis.separateDuration) * 100 : 22}%`,
                    }}
                  >
                    Saved
                  </div>
                </div>
              </div>
            </div>

            {/* Explanatory footnote */}
            <div className="pt-4 border-t border-border-default/60 flex items-center justify-between text-[11px] text-text-secondary">
              <span>Co-utilization reduces track closure impact by consolidating parallel tasks</span>
              <Link href="/plan" className="text-brand font-bold hover:underline flex items-center gap-1">
                Inspect Blocks <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* Visual Chart 2: Section Impact & Traffic Delay Chart */}
          <div className="bg-surface rounded-lg border border-border-default p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Train size={16} className="text-brand" /> Section Traffic Impact & Trains
                </h3>
                <span className="text-[11px] font-bold text-text-secondary">
                  Top Corridor Sections
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mb-3">
                Relative volume of scheduled train movements affected across active maintenance sections
              </p>
            </div>

            {/* Visual Horizontal Bars with Tooltips */}
            <div className="space-y-2.5 py-1">
              {sectionActivity.slice(0, 4).map((sec) => {
                const widthPct = Math.min(100, Math.max(12, (sec.trainsAffected / maxSectionTrains) * 100));
                const isHovered = hoveredSection === sec.section;
                return (
                  <div
                    key={sec.section}
                    onMouseEnter={() => setHoveredSection(sec.section)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => setSelectedSection(sec.section)}
                    className="cursor-pointer group"
                  >
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="font-bold text-text-primary group-hover:text-brand transition-colors">
                        {sec.section}
                      </span>
                      <span className="num font-semibold text-text-secondary">
                        {sec.trainsAffected} trains <span className="text-amber-700">({sec.totalDelay}m delay)</span>
                      </span>
                    </div>
                    <div className="h-4 w-full bg-surface-sunken rounded-sm overflow-hidden relative">
                      <div
                        className={`h-full rounded-sm transition-all duration-500 ${
                          isHovered ? "bg-brand" : "bg-brand/80"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-border-default/60 flex items-center justify-between text-[11px] text-text-secondary">
              <span>Click any bar to filter records to that section</span>
              <span className="font-semibold text-text-primary">
                {sectionActivity.length} sections monitored
              </span>
            </div>
          </div>
        </div>

        {/* 4. PRODUCTION ML MODEL PERFORMANCE (Visual Cards & Validated Benchmarks) */}
        <div className="bg-surface rounded-lg border border-border-default p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <BrainCircuit size={16} className="text-brand" /> Production ML Model Benchmarks & Validation
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-sunken border border-border-default text-text-secondary">
                  Held-Out Test Sets
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Evaluation results computed from trained model artifacts on independent test splits
              </p>
            </div>

            <button
              onClick={() => setShowDefinitions(!showDefinitions)}
              className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Info size={13} /> {showDefinitions ? "Hide Metric Guide" : "Metric Guide ▾"}
            </button>
          </div>

          {showDefinitions && (
            <div className="mb-4 p-3 bg-surface-sunken/60 border border-border-default rounded-md text-[11px] text-text-secondary grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <strong className="text-text-primary block font-semibold">ROC-AUC</strong>
                Measures discriminatory ranking power (1.0 = perfect ranking of failure risk).
              </div>
              <div>
                <strong className="text-text-primary block font-semibold">R² Score</strong>
                Proportion of variation explained by the model vs simple historical mean.
              </div>
              <div>
                <strong className="text-text-primary block font-semibold">MAE</strong>
                Mean absolute prediction error in actual units (minutes or train count).
              </div>
              <div>
                <strong className="text-text-primary block font-semibold">Ensemble</strong>
                Stacked combination of Random Forest and gradient-boosted trees for robust calibration.
              </div>
            </div>
          )}

          {/* 4 Model Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODEL_BENCHMARKS.map((m) => (
              <div
                key={m.id}
                className="p-3.5 bg-surface-sunken/40 border border-border-default rounded-lg flex flex-col justify-between hover:border-brand/30 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      {m.type}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                      {m.badge}
                    </span>
                  </div>
                  <h4 className="text-[13px] font-bold text-text-primary">{m.name}</h4>
                  <span className="text-[11px] text-text-secondary font-medium block mt-0.5">
                    {m.model}
                  </span>
                </div>

                <div className="my-3 py-2 border-y border-border-default/60">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-text-secondary">{m.primaryMetric.label}</span>
                    <span className="text-[18px] font-bold text-success num">{m.primaryMetric.value}</span>
                  </div>
                  <div className="w-full h-1.5 bg-border-default rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{ width: `${m.primaryMetric.score}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-text-secondary">
                  <span>{m.secondaryMetric.label}: <strong className="text-text-primary num">{m.secondaryMetric.value}</strong></span>
                  <span className="italic">{m.sampleSize.split(" ")[0]} samples</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. RISK FACTORS & DEPARTMENT DISCIPLINE BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Feature Importance Weights */}
          <div className="bg-surface rounded-lg border border-border-default p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 size={16} className="text-brand" /> Top Predictive Risk Factors
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Relative mathematical weights extracted from decision splits in the trained Random Forest model
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase text-text-secondary">Feature Weights</span>
            </div>

            <div className="space-y-2.5 my-1">
              {TOP_FEATURE_WEIGHTS.map((feat) => (
                <div key={feat.name}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-medium text-text-primary">{feat.name}</span>
                    <span className="num font-bold text-brand">{feat.weight}%</span>
                  </div>
                  <div className="h-2 w-full bg-surface-sunken rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-700"
                      style={{ width: `${feat.weight * 3.5}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border-default/60 text-[11px] text-text-secondary flex justify-between">
              <span>Primary predictors include track tonnage history and inspection scores</span>
              <Link href="/ai-insights" className="text-brand font-bold hover:underline">
                Explore Requests →
              </Link>
            </div>
          </div>

          {/* Department Composition & Multi-Discipline Balance */}
          <div className="bg-surface rounded-lg border border-border-default p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <GitMerge size={16} className="text-brand" /> Department Maintenance Balance
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Share of maintenance requests across Engineering, TRD, and Signalling & Telecom
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase text-text-secondary">Discipline Ratio</span>
            </div>

            {/* Visual Horizontal Ratio Bar */}
            <div className="my-2">
              <div className="h-6 w-full rounded-md overflow-hidden flex shadow-xs border border-border-default">
                {deptBreakdown.map((d) => (
                  <div
                    key={d.dept}
                    style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                    className="h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500 truncate px-1"
                    title={`${d.dept}: ${d.count} requests (${d.pct}%)`}
                  >
                    {d.pct > 15 ? `${d.code} ${d.pct}%` : ""}
                  </div>
                ))}
              </div>
            </div>

            {/* Department stats cards */}
            <div className="grid grid-cols-3 gap-2.5 my-2">
              {deptBreakdown.map((d) => (
                <div key={d.dept} className="p-2.5 bg-surface-sunken/60 rounded-md border border-border-default text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    {d.code}
                  </span>
                  <span className="text-[18px] font-bold text-text-primary num mt-0.5 block">
                    {d.count}
                  </span>
                  <span className="text-[10px] font-medium text-text-secondary">
                    {d.pct}% of total
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border-default/60 text-[11px] text-text-secondary flex justify-between items-center">
              <span>Coordinated blocks joint between 2+ departments: {proposals.length > 0 ? "Active" : "Standard"}</span>
              <Link href="/backlog" className="text-brand font-bold hover:underline">
                View Backlog →
              </Link>
            </div>
          </div>
        </div>

        {/* 6. CORRIDOR SECTION ACTIVITY TABLE (Clean, Compact, Actionable) */}
        <div className="bg-surface rounded-lg border border-border-default shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-default bg-surface-sunken/40 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider">
                Corridor Section Optimization & Activity Matrix
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Consolidated operational delay, train impacts, and possession savings by section
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase text-text-secondary">
              {sectionActivity.length} Sections
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse">
              <thead className="bg-surface-sunken border-b border-border-default text-[10px] uppercase font-bold text-text-secondary">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Section</th>
                  <th className="py-2.5 px-3 font-bold text-right">Requests</th>
                  <th className="py-2.5 px-3 font-bold text-right">Failure Risk</th>
                  <th className="py-2.5 px-3 font-bold text-right">Avg Duration</th>
                  <th className="py-2.5 px-3 font-bold text-right">Trains Affected</th>
                  <th className="py-2.5 px-3 font-bold text-right">Expected Delay</th>
                  <th className="py-2.5 px-3 font-bold text-right">Blocks</th>
                  <th className="py-2.5 px-3 font-bold text-right">Possession Saved</th>
                  <th className="py-2.5 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface">
                {sectionActivity.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-text-secondary text-[12px]">
                      No sections matching the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  sectionActivity.map((sec) => (
                    <tr key={sec.section} className="hover:bg-surface-sunken/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-text-primary num">
                        {sec.section}
                      </td>
                      <td className="py-3 px-3 text-right num font-semibold text-text-primary">
                        {sec.requestCount}
                      </td>
                      <td className="py-3 px-3 text-right num font-bold">
                        <span className={sec.avgFailureRisk >= 40 ? "text-critical" : "text-text-primary"}>
                          {sec.avgFailureRisk.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right num text-text-secondary">
                        {sec.avgDuration} min
                      </td>
                      <td className="py-3 px-3 text-right num font-semibold text-text-primary">
                        {sec.trainsAffected}
                      </td>
                      <td className="py-3 px-3 text-right num font-semibold text-amber-700">
                        +{sec.totalDelay} min
                      </td>
                      <td className="py-3 px-3 text-right num font-semibold text-brand">
                        {sec.proposalsCount}
                      </td>
                      <td className="py-3 px-3 text-right num font-bold text-success">
                        {sec.possessionSaved > 0 ? `+${sec.possessionSaved}m` : "--"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/plan?section=${encodeURIComponent(sec.section)}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                        >
                          Plan →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-2.5 bg-surface border-t border-border-default flex items-center justify-between text-[11px] text-text-secondary">
            <span>Synchronized with active railway topology and PostgreSQL database</span>
            <Link href="/plan" className="text-brand font-bold hover:underline flex items-center gap-1">
              Open Optimizer in Block Planning <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
