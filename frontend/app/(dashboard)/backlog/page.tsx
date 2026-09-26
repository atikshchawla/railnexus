"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout";
import { SearchBar } from "@/components/shared";
import { useDashboardData } from "@/lib/dashboard-context";
import { Plus, ArrowRight, Square, Circle, Triangle, X, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import type { Category, Department, BlockRecord } from "@/lib/types";
import { createMaintenance, predictMaintenance } from "@/lib/api";
import {
  DepartmentBadge,
  ConflictIndicator,
  StatusPill,
  AcronymLegend,
} from "@/components/shared";
import { URGENCY_COLORS } from "@/components/shared/DesignTokens";

const SECTIONS = [
  "AJJ-SHU", "SHU-WJR", "WJR-MCN", "MCN-KPD", 
  "KPD-GYM", "GYM-AB", "AB-VN", "VN-JTJ",
];

const WORK_TYPES: Record<string, string[]> = {
  ENGG: ["Track Renewal", "Ballast Cleaning", "Bridge Repair", "Track Maintenance", "Rail Grinding"],
  TRD: ["OHE Maintenance", "Substation Repair", "Tower Car Inspection", "Power Feeder Check"],
  "S&T": ["Signal Maintenance", "Point Machine Repair", "Cable Trenching", "Track Circuit Replacement"],
};

const DEPT_HUES: Record<Department, string> = {
  Engg: "text-amber-700",
  TRD: "text-blue-700",
  "S&T": "text-green-700",
};

function CategoryIcon({ category, dept }: { category: Category; dept: Department }) {
  const colorClass = DEPT_HUES[dept] || "text-amber-700";
  switch (category) {
    case "IMR": return <Square size={14} strokeWidth={2.5} className={colorClass} />;
    case "OBS": return <Circle size={14} strokeWidth={2.5} className={colorClass} />;
    case "PM": return <Triangle size={14} strokeWidth={2.5} className={colorClass} />;
  }
}

export default function BacklogPage() {
  const router = useRouter();
  const { data, loading, error, refresh } = useDashboardData();
  const { blocks } = data;
  
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState("urgency");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form Fields
  const [formSection, setFormSection] = useState("AJJ-SHU");
  const [formDept, setFormDept] = useState("ENGG");
  const [formWorkType, setFormWorkType] = useState("Track Maintenance");
  const [formLocationKm, setFormLocationKm] = useState("10.5");
  const [formPriority, setFormPriority] = useState("HIGH");
  const [formSafetyCritical, setFormSafetyCritical] = useState(true);
  const [formDeadlineHours, setFormDeadlineHours] = useState("24");

  // Drawer
  const [drawerBlock, setDrawerBlock] = useState<BlockRecord | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const filtered = useMemo(() => {
    return blocks.filter((item) => {
      if (deptFilter !== "All" && item.department !== deptFilter) return false;
      if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
      if (statusFilter !== "All" && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.id.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || (item.location.section || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [blocks, deptFilter, categoryFilter, statusFilter, search]);

  const sortedAndFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortMode === "urgency") {
        const scoreA = a.urgency.tier === 'critical' ? 3 : a.urgency.tier === 'warning' ? 2 : 1;
        const scoreB = b.urgency.tier === 'critical' ? 3 : b.urgency.tier === 'warning' ? 2 : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (a.urgency.timeToBreachHours || 999) - (b.urgency.timeToBreachHours || 999);
      }
      if (sortMode === "newest") {
         return b.id.localeCompare(a.id);
      }
      return 0;
    });
  }, [filtered, sortMode]);

  const openRequests = blocks.filter(b => b.status === "Under review" || b.status === "Proposed").length;
  const atRisk = blocks.filter(b => b.urgency.tier === "critical" || b.urgency.tier === "warning").length;
  const dueSoon = blocks.filter(b => b.urgency.timeToBreachHours !== null && b.urgency.timeToBreachHours <= 72).length;
  const planned = blocks.filter(b => b.status === "Approved" || b.status === "Active" || b.status === "Completed").length;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const created = await createMaintenance({
        section_id: formSection,
        department: formDept,
        work_type: formWorkType,
        location_km: parseFloat(formLocationKm) || 0.0,
        priority: formPriority,
        safety_critical: formSafetyCritical,
        deadline_minutes: (parseInt(formDeadlineHours, 10) || 24) * 60,
        model_features: {
          asset_age_days: 1800,
          days_since_last_maintenance: 90,
          previous_failure_count: 1,
          lifetime_tonnage_mgt: 350.0,
          tonnage_since_last_maintenance_mgt: 60.0,
          daily_train_count: 110,
          daily_tonnage_mgt: 2.2,
          inspection_score: 65,
          rainfall_mm: 10.0,
          temperature_mean_c: 30.0,
          max_wind_speed_kmh: 20.0,
          is_heavy_rain_day: false,
          asset_type: "TRACK_CIRCUIT",
          department: formDept,
          section_id: formSection,
          planned_duration_minutes: 90,
          severity_score: formPriority === "CRITICAL" ? 9 : 7,
          workers_required: 6,
          equipment_count: 2,
          workload_per_worker: 15.0,
          weather_risk: 0.2,
          congestion_score: 0.3,
          current_delay_minutes: 5,
          window_average_delay_minutes: 6,
          window_peak_delay_minutes: 15,
          accumulated_tonnage_mgt: 350.0,
          trains_in_section: 6,
          section_complexity: 0.6,
          traffic_density: 0.7,
          safety_critical: formSafetyCritical,
          is_heatwave_day: false,
          is_rain_day: false,
          request_hour: new Date().getHours(),
          request_day_of_week: new Date().getDay(),
          request_month: new Date().getMonth() + 1,
          request_is_weekend: new Date().getDay() === 0 || new Date().getDay() === 6,
          location_km_marker: parseFloat(formLocationKm) || 10.0,
          window_train_count: 6,
          planned_start_hour: new Date().getHours(),
          work_type: formWorkType,
          priority: formPriority,
        },
      });

      // Score with ML predictor
      try {
        await predictMaintenance(created.id);
      } catch (_) {
        // prediction fallback handled gracefully
      }

      setFormSuccess(`Created ${created.id} successfully!`);
      refresh();
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create maintenance request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col h-full bg-canvas">
        <TopBar
          title="Maintenance backlog"
          subtitle="Authoritative repository of maintenance requests and predictive priorities"
        />
        
        {/* Operational Summary */}
        <div className="px-6 py-4 bg-surface border-b border-border-default flex gap-8 items-center shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase mb-0.5">Open Requests</span>
            <span className="text-[18px] font-medium leading-none text-text-primary num">{openRequests}</span>
          </div>
          <div className="w-px h-8 bg-border-default"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-critical tracking-wider uppercase mb-0.5">At Risk</span>
            <span className="text-[18px] font-medium leading-none text-critical num">{atRisk}</span>
          </div>
          <div className="w-px h-8 bg-border-default"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-amber-600 tracking-wider uppercase mb-0.5">Due Soon</span>
            <span className="text-[18px] font-medium leading-none text-amber-600 num">{dueSoon}</span>
          </div>
          <div className="w-px h-8 bg-border-default"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase mb-0.5">Planned</span>
            <span className="text-[18px] font-medium leading-none text-text-primary num">{planned}</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-5 flex flex-col gap-4 overflow-y-hidden">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-critical/10 border border-critical/20 rounded-sm text-critical text-[12px] shrink-0">
              <AlertCircle size={15} />
              <span>Failed to sync with backend: {error}</span>
            </div>
          )}

          {/* Single Control Bar */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-64">
              <SearchBar value={search} onChange={(v) => setSearch(v)} />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="Filter by department"
              className="text-[12px] px-2 py-1.5 border border-border-default bg-surface text-text-primary rounded-sm shadow-xs outline-none focus:border-brand"
            >
              <option value="All">Department</option>
              <option value="Engg">ENGG</option>
              <option value="TRD">TRD</option>
              <option value="S&T">S&T</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="text-[12px] px-2 py-1.5 border border-border-default bg-surface text-text-primary rounded-sm shadow-xs outline-none focus:border-brand"
            >
              <option value="All">Category</option>
              <option value="IMR">IMR</option>
              <option value="OBS">OBS</option>
              <option value="PM">PM</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="text-[12px] px-2 py-1.5 border border-border-default bg-surface text-text-primary rounded-sm shadow-xs outline-none focus:border-brand"
            >
              <option value="All">Status</option>
              <option value="under review">Under review</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>

            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setShowLegend(!showLegend)} 
                  className="text-[11px] font-bold text-text-secondary hover:text-text-primary uppercase tracking-wider flex items-center gap-1 bg-transparent border-none cursor-pointer outline-none"
                >
                  <Info size={13} /> Legend ▾
                </button>
                {showLegend && (
                  <div className="absolute top-full mt-1 right-0 w-80 bg-surface border border-border-default shadow-lg p-3 z-50 rounded-sm">
                    <AcronymLegend />
                  </div>
                )}
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                aria-label="Sort"
                className="text-[12px] px-2 py-1.5 border border-border-default bg-surface text-text-primary rounded-sm shadow-xs font-medium outline-none focus:border-brand"
              >
                <option value="urgency">Sort: Urgency / SLA</option>
                <option value="newest">Sort: Newest First</option>
              </select>
              <button
                onClick={() => {
                  setFormError(null);
                  setFormSuccess(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface cursor-pointer rounded-sm shadow-xs outline-none focus:ring-1 focus:ring-brand"
              >
                <Plus size={13} strokeWidth={2} />
                Report New Defect
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="shrink-0 p-2.5 bg-brand/10 border border-brand/20 flex items-center justify-between rounded-sm">
              <span className="text-[12px] font-bold text-brand tracking-wide">{selectedIds.size} REQUESTS SELECTED</span>
              <button
                onClick={() => {
                  const ids = Array.from(selectedIds).join(",");
                  router.push(`/plan?requests=${encodeURIComponent(ids)}`);
                }}
                className="px-3 py-1 bg-brand text-white text-[11px] font-bold rounded-sm hover:bg-brand-hover shadow-xs uppercase tracking-wide cursor-pointer outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              >
                Plan Selected
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-surface border border-border-default overflow-hidden flex flex-col flex-1 min-h-0 rounded-sm shadow-sm">
            <div className="overflow-y-auto flex-1 bg-canvas">
              <table className="w-full text-[12px] text-left border-collapse">
                <thead className="sticky top-0 bg-surface-sunken shadow-sm z-10">
                  <tr className="text-text-secondary uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-2.5 font-bold border-b border-border-default w-10">
                      <input type="checkbox" className="rounded-sm border-border-default cursor-pointer text-brand focus:ring-brand" checked={selectedIds.size === sortedAndFiltered.length && sortedAndFiltered.length > 0} onChange={() => {
                        if (selectedIds.size === sortedAndFiltered.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(sortedAndFiltered.map(r => r.id)));
                      }} />
                    </th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Request</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Location</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Owner</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Deadline</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Conflict</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Status</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default">Source</th>
                    <th className="px-4 py-2.5 font-bold border-b border-border-default text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default bg-surface">
                  {sortedAndFiltered.map((item) => {
                    const isAging = item.status === "Under review" && (item.urgency.tier === "critical" || item.urgency.tier === "warning");
                    const isBreached = item.urgency.timeToBreachHours !== null && item.urgency.timeToBreachHours <= 0;
                    
                    let deadlineNode;
                    if (item.urgency.timeToBreachHours === null) {
                      deadlineNode = <div className="text-text-secondary font-medium">Routine</div>;
                    } else if (isBreached) {
                      deadlineNode = (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-critical uppercase">SLA Breached</span>
                          <span className="text-critical font-medium">Overdue</span>
                        </div>
                      );
                    } else {
                      const days = Math.ceil(item.urgency.timeToBreachHours / 24);
                      deadlineNode = (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">SLA</span>
                          <span className={`font-medium ${item.urgency.tier === 'critical' ? 'text-critical' : item.urgency.tier === 'warning' ? 'text-amber-600' : 'text-text-primary'}`}>
                            {item.urgency.timeToBreachHours < 24 ? "Breach in < 24h" : `${days} day${days !== 1 ? 's' : ''} remaining`}
                          </span>
                        </div>
                      );
                    }

                    const isPlanned = item.status === "Approved" || item.status === "Active" || item.status === "Completed";
                    const isDemo = item.id.startsWith("DEMO-") || item.work_type === "DEMO_MAINTENANCE_BLOCK";

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setDrawerBlock(item)}
                        className={`hover:bg-surface-sunken/80 transition-colors group cursor-pointer ${selectedIds.has(item.id) ? 'bg-brand/5' : ''}`}
                        style={{ "--urgency-color": URGENCY_COLORS[item.urgency.tier] } as React.CSSProperties}
                      >
                        <td className={`px-4 py-3 border-l-[3px] transition-colors ${isAging ? "border-[var(--urgency-color)]" : "border-transparent group-hover:border-[var(--urgency-color)]"}`} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded-sm border-border-default cursor-pointer text-brand focus:ring-brand" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />
                        </td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <CategoryIcon category={item.category} dept={item.department} />
                              <span className="text-[11px] font-bold text-text-primary tracking-wide">{item.category}</span>
                              {isDemo && <span className="text-[9px] bg-border-default/50 text-text-secondary px-1 rounded uppercase tracking-widest font-bold">DEMO</span>}
                            </div>
                            <span className="font-mono font-bold text-[13px] text-text-primary num mt-0.5">
                              {item.id.length > 20 ? item.id.substring(0, 12) + '...' : item.id}
                            </span>
                            <span className="text-text-secondary text-[11px] truncate max-w-[250px] font-medium">
                              {item.description}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                           <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[11px] text-text-primary tracking-wide">
                                {item.location.section || "UNKNOWN SEC"}
                              </span>
                              <span className="text-text-secondary text-[11px] font-medium">
                                Km {item.location.kmStart} {item.location.line ? item.location.line.toUpperCase() : ''}
                              </span>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                          <DepartmentBadge dept={item.department} />
                        </td>
                        <td className="px-4 py-3">
                          {deadlineNode}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.conflict ? (
                            <div className="flex flex-col gap-0.5">
                              <ConflictIndicator conflictId={item.conflict.conflictId} />
                              <span className="text-[10px] text-text-secondary capitalize font-medium">
                                {item.conflict.severity} &middot; {item.conflict.status}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-secondary font-medium">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={item.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-text-primary">{item.source.system}</span>
                            <span className="text-[10px] text-text-secondary">{item.source.lastUpdated || '--'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isPlanned ? (
                            <Link
                              href={`/approvals?focus=${encodeURIComponent(item.id)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm shadow-xs transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-brand bg-surface border border-border-default text-text-primary hover:bg-surface-sunken"
                            >
                              View →
                            </Link>
                          ) : (
                            <Link
                              href={`/plan?focus=${encodeURIComponent(item.id)}&request=${encodeURIComponent(item.id)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm shadow-xs transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-brand bg-brand text-white border border-brand hover:bg-brand-hover"
                            >
                              Plan →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedAndFiltered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                           <span className="text-[14px] font-bold text-text-primary">NO MATCHING REQUESTS</span>
                           <span className="text-[12px] text-text-secondary">{loading ? "Loading maintenance backlog..." : "Try changing the department, category, status or search."}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 text-[11px] font-medium text-text-secondary border-t border-border-default flex justify-between items-center bg-surface shrink-0">
              <span>Showing {sortedAndFiltered.length} request{sortedAndFiltered.length !== 1 ? "s" : ""}</span>
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">RailNexus Core Backbone</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {drawerBlock && (
        <div className="w-[380px] shrink-0 bg-surface border-l border-border-default flex flex-col h-full shadow-xl animate-in slide-in-from-right-8 duration-200 z-40">
          <div className="px-5 py-4 border-b border-border-default flex items-center justify-between shrink-0 bg-surface-sunken">
            <h2 className="text-[12px] font-bold tracking-widest text-text-secondary uppercase">Request Details</h2>
            <button
              onClick={() => setDrawerBlock(null)}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer p-1 outline-none focus:ring-1 focus:ring-brand rounded-sm"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Header Identity */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-brand/10 text-brand">
                  {drawerBlock.category === 'IMR' ? 'Immediate Repair' : drawerBlock.category === 'OBS' ? 'Observation' : 'Preventive'}
                </span>
                {(drawerBlock.id.startsWith("DEMO-") || drawerBlock.work_type === "DEMO_MAINTENANCE_BLOCK") && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-border-default/50 text-text-secondary">DEMO</span>}
              </div>
              <h3 className="text-[18px] font-mono font-bold text-text-primary mb-1 num tracking-tight">{drawerBlock.id}</h3>
              <p className="text-[13px] font-medium text-text-secondary">{drawerBlock.description}</p>
            </div>
            
            {/* Location & Dept */}
            <div className="grid grid-cols-2 gap-4 border-y border-border-default py-4">
               <div>
                  <span className="block text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">Location</span>
                  <span className="block text-[13px] font-bold text-text-primary">{drawerBlock.location.section || "UNKNOWN"}</span>
                  <span className="block text-[12px] text-text-secondary font-medium">Km {drawerBlock.location.kmStart} {drawerBlock.location.line ? drawerBlock.location.line.toUpperCase() : ''}</span>
               </div>
               <div>
                  <span className="block text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">Department</span>
                  <div className="inline-block"><DepartmentBadge dept={drawerBlock.department} /></div>
               </div>
            </div>

            {/* SLA & Status */}
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <span className="block text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">SLA Deadline</span>
                  {drawerBlock.urgency.timeToBreachHours === null ? (
                    <span className="text-[13px] font-medium text-text-secondary">Routine (No SLA)</span>
                  ) : drawerBlock.urgency.timeToBreachHours <= 0 ? (
                    <span className="text-[13px] font-bold text-critical">Breached</span>
                  ) : (
                    <span className={`text-[13px] font-bold ${drawerBlock.urgency.tier === 'critical' ? 'text-critical' : 'text-amber-600'}`}>
                      {Math.ceil(drawerBlock.urgency.timeToBreachHours / 24)} day(s) remaining
                    </span>
                  )}
               </div>
               <div>
                  <span className="block text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">Status</span>
                  <div className="inline-block"><StatusPill status={drawerBlock.status} /></div>
               </div>
            </div>

            {/* Source */}
            <div>
              <span className="block text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">Source</span>
              <span className="text-[13px] font-medium text-text-primary">{drawerBlock.source.system}</span>
              <span className="text-[12px] text-text-secondary ml-2">{drawerBlock.source.lastUpdated || '--'}</span>
            </div>

            {/* ML Prediction */}
            <div className="bg-surface-sunken p-4 border border-border-default rounded-sm">
               <span className="block text-[10px] font-bold tracking-widest text-brand uppercase mb-2 flex items-center justify-between">
                 <span>Predictive Priority</span>
                 {drawerBlock.mlPrediction && (
                   <Link
                     href={`/ai-insights?request_id=${encodeURIComponent(drawerBlock.id)}`}
                     className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline capitalize"
                   >
                     AI Analysis →
                   </Link>
                 )}
               </span>
               {drawerBlock.mlPrediction ? (
                 <div className="flex items-center gap-4">
                    <div className="text-[24px] font-bold text-text-primary num leading-none">
                      {Math.round(((drawerBlock.mlPrediction.severityScore ?? drawerBlock.mlPrediction.priorityScore) || 0) * 10)}<span className="text-[14px] text-text-secondary">/100</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-text-primary">AI Risk Score</span>
                      <span className="text-[10px] text-text-secondary">Based on asset history</span>
                    </div>
                 </div>
               ) : (
                 <span className="text-[12px] text-text-secondary italic">No prediction available</span>
               )}
            </div>

            {/* Conflict */}
            <div>
               <span className="block text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-2">Conflict Status</span>
               {drawerBlock.conflict ? (
                 <div className="inline-block"><ConflictIndicator conflictId={drawerBlock.conflict.conflictId} /></div>
               ) : (
                 <span className="text-[12px] text-text-secondary font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-positive"/> No known conflicts
                 </span>
               )}
            </div>
          </div>
          
          <div className="p-5 border-t border-border-default bg-surface shrink-0">
             {(drawerBlock.status === "Approved" || drawerBlock.status === "Active" || drawerBlock.status === "Completed") ? (
                <Link
                  href={`/approvals?focus=${encodeURIComponent(drawerBlock.id)}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-[12px] font-bold bg-surface border border-border-default text-text-primary hover:bg-surface-sunken transition-colors uppercase tracking-wider rounded-sm outline-none focus:ring-2 focus:ring-brand"
                >
                  View Block Details <ArrowRight size={14} />
                </Link>
             ) : (
                <Link
                  href={`/plan?focus=${encodeURIComponent(drawerBlock.id)}&request=${encodeURIComponent(drawerBlock.id)}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-[12px] font-bold bg-brand text-white hover:bg-brand-hover transition-colors uppercase tracking-wider rounded-sm shadow-xs outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                >
                  Plan Request <ArrowRight size={14} />
                </Link>
             )}
          </div>
        </div>
      )}

      {/* Report Defect Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface border border-border-default max-w-lg w-full shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 rounded-sm">
            <div className="px-5 py-4 border-b border-border-default flex items-center justify-between bg-surface-sunken">
              <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2 uppercase tracking-wide">
                <Plus size={16} className="text-brand" strokeWidth={3} /> Report New Defect
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-brand rounded-sm"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-[12px]">
              {formError && (
                <div className="p-3 bg-critical/10 border border-critical/20 rounded-sm text-critical flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span className="font-medium">{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-sm text-success flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span className="font-medium">{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 font-bold text-text-primary tracking-wide">
                  Corridor Section
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-2 rounded-sm focus:border-brand outline-none font-medium shadow-xs"
                    required
                  >
                    {SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 font-bold text-text-primary tracking-wide">
                  Department
                  <select
                    value={formDept}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setFormDept(dept);
                      setFormWorkType(WORK_TYPES[dept]?.[0] || "Track Maintenance");
                    }}
                    className="bg-surface border border-border-default px-2.5 py-2 rounded-sm focus:border-brand outline-none font-medium shadow-xs"
                    required
                  >
                    <option value="ENGG">ENGG</option>
                    <option value="TRD">TRD</option>
                    <option value="S&T">S&T</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 font-bold text-text-primary tracking-wide">
                  Work Type
                  <select
                    value={formWorkType}
                    onChange={(e) => setFormWorkType(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-2 rounded-sm focus:border-brand outline-none font-medium shadow-xs"
                    required
                  >
                    {(WORK_TYPES[formDept] || WORK_TYPES.ENGG).map((wt) => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 font-bold text-text-primary tracking-wide">
                  Location (KM Marker)
                  <input
                    type="number"
                    step="0.1"
                    value={formLocationKm}
                    onChange={(e) => setFormLocationKm(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-2 rounded-sm focus:border-brand outline-none font-medium shadow-xs"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 font-bold text-text-primary tracking-wide">
                  Operational Priority
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-2 rounded-sm focus:border-brand outline-none font-medium shadow-xs"
                    required
                  >
                    <option value="CRITICAL">CRITICAL (&lt; 24h breach)</option>
                    <option value="HIGH">HIGH (24–72h)</option>
                    <option value="MEDIUM">MEDIUM (Caution)</option>
                    <option value="LOW">LOW (Routine)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 font-bold text-text-primary tracking-wide">
                  SLA Deadline (Hours)
                  <input
                    type="number"
                    min="1"
                    value={formDeadlineHours}
                    onChange={(e) => setFormDeadlineHours(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-2 rounded-sm focus:border-brand outline-none font-medium shadow-xs"
                    required
                  />
                </label>
              </div>

              <label className="flex items-center gap-2.5 font-bold text-text-primary pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSafetyCritical}
                  onChange={(e) => setFormSafetyCritical(e.target.checked)}
                  className="rounded-sm text-brand focus:ring-0 shadow-xs cursor-pointer"
                />
                <span>Safety Critical Defect (Requires immediate traffic suspension)</span>
              </label>

              <div className="px-5 py-4 bg-surface-sunken border-t border-border-default -mx-5 -mb-5 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer rounded-sm uppercase tracking-wide outline-none focus:ring-1 focus:ring-brand"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer rounded-sm uppercase tracking-wide shadow-xs outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Scoring..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
