"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout";
import { SearchBar } from "@/components/shared";
import { useDashboardData } from "@/lib/dashboard-context";
import { Plus, ArrowRight, Square, Circle, Triangle, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { Category, Department, BlockRecord } from "@/lib/types";
import { createMaintenance, predictMaintenance } from "@/lib/api";
import {
  DepartmentBadge,
  UrgencyText,
  ConflictIndicator,
  StatusPill,
  AcronymLegend,
} from "@/components/shared";
import { URGENCY_COLORS } from "@/components/shared/DesignTokens";

const SECTIONS = [
  "AJJ-SHU",
  "SHU-WJR",
  "WJR-MCN",
  "MCN-KPD",
  "KPD-GYM",
  "GYM-AB",
  "AB-VN",
  "VN-JTJ",
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
    case "IMR":
      return <Square size={16} strokeWidth={2.5} className={colorClass} />;
    case "OBS":
      return <Circle size={16} strokeWidth={2.5} className={colorClass} />;
    case "PM":
      return <Triangle size={16} strokeWidth={2.5} className={colorClass} />;
  }
}

export default function BacklogPage() {
  const { data, loading, error, refresh } = useDashboardData();
  const { blocks } = data;
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

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

  const filtered = blocks.filter((item) => {
    if (deptFilter !== "All" && item.department !== deptFilter) return false;
    if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.id.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

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
    <>
      <TopBar
        title="Maintenance backlog"
        subtitle="Authoritative repository of maintenance requests and predictive priorities"
      />
      <div className="flex-1 min-h-0 p-5 space-y-4 overflow-y-auto bg-canvas">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-critical/10 border border-critical/20 rounded-sm text-critical text-[12px]">
            <AlertCircle size={15} />
            <span>Failed to sync with backend: {error}</span>
          </div>
        )}

        <AcronymLegend />

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchBar value={search} onChange={(v) => setSearch(v)} />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter by department"
            className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            <option value="All">All departments</option>
            <option value="Engg">Engineering (ENGG)</option>
            <option value="TRD">Traction (TRD)</option>
            <option value="S&T">Signalling (S&T)</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="text-[12.5px] px-2 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            <option value="All">All categories</option>
            <option value="IMR">IMR (Immediate)</option>
            <option value="OBS">OBS (Observe)</option>
            <option value="PM">PM (Predictive)</option>
          </select>
          <button
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setIsModalOpen(true);
            }}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors bg-surface cursor-pointer"
          >
            <Plus size={13} strokeWidth={2} />
            Report a new defect
          </button>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border-default overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px]">
                <th scope="col" className="px-4 py-2.5 font-semibold">Category</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">ID</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Dept</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Location</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Time-to-breach</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Source</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Conflict</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filtered.map((item) => {
                const isAging =
                  item.status === "Under review" &&
                  (item.urgency.tier === "critical" || item.urgency.tier === "warning");
                const breachText =
                  item.urgency.timeToBreachHours === null
                    ? "Routine"
                    : `${Math.ceil(item.urgency.timeToBreachHours / 24)} days to SLA breach`;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-sunken/50 transition-colors group"
                    style={{ "--urgency-color": URGENCY_COLORS[item.urgency.tier] } as React.CSSProperties}
                  >
                    <td
                      className={`px-4 py-2.5 border-l-[3px] transition-colors ${
                        isAging ? "border-[var(--urgency-color)]" : "border-transparent group-hover:border-[var(--urgency-color)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={item.category} dept={item.department} />
                        <span className="text-[11px] font-semibold text-text-primary tracking-wide">
                          {item.category}
                        </span>
                        {isAging && (
                          <span className="ml-1 inline-block px-1 bg-critical/10 text-critical text-[9px] font-bold uppercase rounded-sm border border-critical/20">
                            Aging
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 num font-medium text-[12px]">{item.id}</td>
                    <td className="px-4 py-2.5">
                      <DepartmentBadge dept={item.department} />
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-text-primary">{item.description}</td>
                    <td className="px-4 py-2.5 text-[12px] whitespace-nowrap text-text-secondary">
                      Km {item.location.kmStart} ({item.location.line})
                    </td>
                    <td className="px-4 py-2.5">
                      <UrgencyText tier={item.urgency.tier} text={breachText} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold">{item.source.system}</span>
                        <span className="text-[10px] text-text-secondary">{item.source.lastUpdated}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.conflict ? (
                        <Link href={`/conflicts#${item.conflict.conflictId}`} className="hover:underline">
                          <ConflictIndicator conflictId={item.conflict.conflictId} />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {item.status === "Approved" || item.status === "Active" ? (
                        <Link
                          href={`/approvals?focus=${encodeURIComponent(item.id)}`}
                          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand hover:underline whitespace-nowrap"
                        >
                          Approved <ArrowRight size={12} />
                        </Link>
                      ) : (
                        <Link
                          href={`/plan?request=${encodeURIComponent(item.id)}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11.5px] font-medium bg-surface-sunken border border-border-default text-text-primary hover:bg-surface-sunken/80 transition-colors whitespace-nowrap"
                        >
                          Plan in Optimizer <ArrowRight size={12} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-text-secondary text-[13px]">
                    {loading ? "Loading maintenance requests from Core backend..." : "No maintenance requests found matching current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[11px] text-text-secondary border-t border-border-default flex justify-between items-center">
            <span>Showing {filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
            <span className="text-[10px] text-text-secondary">Core RailNexus Authoritative Persistence</span>
          </div>
        </div>
      </div>

      {/* Report Defect Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-default max-w-lg w-full shadow-lg flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
                <Plus size={16} className="text-brand" /> Report New Maintenance Defect
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-[13px]">
              {formError && (
                <div className="p-3 bg-critical/10 border border-critical/20 rounded-sm text-critical text-[12px] flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-sm text-success text-[12px] flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Corridor Section
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-1.5 rounded-sm focus:border-brand outline-none"
                    required
                  >
                    {SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Department
                  <select
                    value={formDept}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setFormDept(dept);
                      setFormWorkType(WORK_TYPES[dept]?.[0] || "Track Maintenance");
                    }}
                    className="bg-surface border border-border-default px-2.5 py-1.5 rounded-sm focus:border-brand outline-none"
                    required
                  >
                    <option value="ENGG">Engineering (ENGG)</option>
                    <option value="TRD">Traction (TRD)</option>
                    <option value="S&T">Signalling (S&T)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Work Type
                  <select
                    value={formWorkType}
                    onChange={(e) => setFormWorkType(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-1.5 rounded-sm focus:border-brand outline-none"
                    required
                  >
                    {(WORK_TYPES[formDept] || WORK_TYPES.ENGG).map((wt) => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Location (KM Marker)
                  <input
                    type="number"
                    step="0.1"
                    value={formLocationKm}
                    onChange={(e) => setFormLocationKm(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-1.5 rounded-sm focus:border-brand outline-none"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Operational Priority
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-1.5 rounded-sm focus:border-brand outline-none"
                    required
                  >
                    <option value="CRITICAL">CRITICAL (&lt; 24h breach)</option>
                    <option value="HIGH">HIGH (24–72h)</option>
                    <option value="MEDIUM">MEDIUM (Caution)</option>
                    <option value="LOW">LOW (Routine)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  SLA Deadline (Hours)
                  <input
                    type="number"
                    min="1"
                    value={formDeadlineHours}
                    onChange={(e) => setFormDeadlineHours(e.target.value)}
                    className="bg-surface border border-border-default px-2.5 py-1.5 rounded-sm focus:border-brand outline-none"
                    required
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-[12px] font-medium text-text-primary pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSafetyCritical}
                  onChange={(e) => setFormSafetyCritical(e.target.checked)}
                  className="rounded-sm text-brand focus:ring-0"
                />
                <span>Safety Critical Defect (Requires immediate traffic suspension during possession)</span>
              </label>

              <div className="px-5 py-3 bg-surface-sunken border-t border-border-default -mx-5 -mb-5 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-[12px] font-medium border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-[12px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  {submitting ? "Creating & Scoring..." : "Submit Maintenance Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
