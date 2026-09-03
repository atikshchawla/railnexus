import Link from "next/link";
import { TopBar } from "@/components/layout";
import { AlertBanner } from "@/components/dashboard";
import { AiChecklist, ProvenanceBadge } from "@/components/shared";
import {
  mockBacklog,
  mockConflicts,
  mockAiSuggestions,
  mockTrainPaths,
} from "@/lib/mock-data";
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  ThumbsUp,
  SlidersHorizontal,
  ThumbsDown,
  Train,
  Truck,
} from "lucide-react";

const categoryStyle: Record<string, string> = {
  IMR: "text-critical bg-critical/8",
  OBS: "text-warning bg-warning-bg",
  PM: "text-info bg-info/8",
};

export default function OverviewPage() {
  const unresolvedConflicts = mockConflicts.filter((c) => !c.resolved);
  const criticalItems = mockBacklog.filter((b) => b.urgency.level === "critical");
  const passengerTrains = mockTrainPaths.filter((t) => t.type !== "Freight");
  const freightTrains = mockTrainPaths.filter((t) => t.type === "Freight");

  return (
    <>
      <TopBar
        title="Overview"
        subtitle="Section: Ambala–Saharanpur, Northern Railway"
      />

      {/* Critical alert — links to the actual item */}
      {criticalItems.length > 0 && (
        <Link href="/backlog">
          <AlertBanner
            message={`${criticalItems.length} critical item${criticalItems.length > 1 ? "s" : ""} require attention — ${criticalItems[0].description}`}
            type="critical"
          />
        </Link>
      )}

      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {/* Row 1: Clickable KPI tiles */}
        <div className="grid grid-cols-4 gap-px bg-border-default border border-border-default">
          <Link href="/backlog" className="bg-surface p-4 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12.5px] text-text-secondary mb-1">Open backlog items</p>
            <p className="text-[28px] font-semibold text-text-primary leading-none num">{mockBacklog.length}</p>
            <p className="text-[11px] text-text-secondary mt-1.5">{criticalItems.length} critical</p>
          </Link>
          <Link href="/conflicts" className="bg-surface p-4 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12.5px] text-text-secondary mb-1">Unresolved conflicts</p>
            <p className="text-[28px] font-semibold text-critical leading-none num">{unresolvedConflicts.length}</p>
            <p className="text-[11px] text-text-secondary mt-1.5">Cross-department overlaps</p>
          </Link>
          <Link href="/approvals" className="bg-surface p-4 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12.5px] text-text-secondary mb-1">Pending approvals</p>
            <p className="text-[28px] font-semibold text-text-primary leading-none num">4</p>
            <p className="text-[11px] text-text-secondary mt-1.5">Sorted by urgency</p>
          </Link>
          <Link href="/plan" className="bg-surface p-4 hover:bg-surface-sunken/50 transition-colors">
            <p className="text-[12.5px] text-text-secondary mb-1">Today&apos;s blocks</p>
            <p className="text-[28px] font-semibold text-text-primary leading-none num">3</p>
            <p className="text-[11px] text-text-secondary mt-1.5">2 active, 1 scheduled</p>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Left: Conflicts + Train timetable */}
          <div className="space-y-5">
            {/* Top conflicts */}
            <div className="bg-surface border border-border-default">
              <div className="px-4 py-2.5 border-b border-border-default flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} strokeWidth={1.75} className="text-critical" />
                  <h3 className="text-[15px] font-semibold text-text-primary">
                    Unresolved conflicts
                  </h3>
                </div>
                <Link href="/conflicts" className="text-[12px] text-brand font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-border-default">
                {unresolvedConflicts.map((c) => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span className="font-medium text-text-primary">{c.blockA.department}</span>
                      <span className="text-text-secondary">vs</span>
                      <span className="font-medium text-text-primary">{c.blockB.department}</span>
                      <span className="text-text-secondary ml-auto num">{c.overlapKm}</span>
                    </div>
                    <p className="text-[12px] text-text-secondary mt-0.5">
                      {c.blockA.id}: {c.blockA.description} · {c.blockB.id}: {c.blockB.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's train timetable */}
            <div className="bg-surface border border-border-default">
              <div className="px-4 py-2.5 border-b border-border-default">
                <h3 className="text-[15px] font-semibold text-text-primary">
                  Today&apos;s train timetable
                </h3>
              </div>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-surface-sunken text-text-secondary text-left">
                    <th className="px-4 py-1.5 font-medium">Type</th>
                    <th className="px-4 py-1.5 font-medium">ID</th>
                    <th className="px-4 py-1.5 font-medium">Name</th>
                    <th className="px-4 py-1.5 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {passengerTrains.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-sunken/50">
                      <td className="px-4 py-1.5">
                        <Train size={12} strokeWidth={1.75} className="text-brand" />
                      </td>
                      <td className="px-4 py-1.5 num">{t.id}</td>
                      <td className="px-4 py-1.5">{t.name}</td>
                      <td className="px-4 py-1.5 text-right num">{t.time}</td>
                    </tr>
                  ))}
                  {freightTrains.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-sunken/50">
                      <td className="px-4 py-1.5">
                        <Truck size={12} strokeWidth={1.75} className="text-text-secondary" />
                      </td>
                      <td className="px-4 py-1.5 num">{t.id}</td>
                      <td className="px-4 py-1.5">{t.name}</td>
                      <td className="px-4 py-1.5 text-right num">{t.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: AI suggestions with constraint checklists */}
          <div className="space-y-5">
            {mockAiSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="bg-surface border border-border-default">
                <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
                  <Cpu size={14} strokeWidth={1.75} className="text-text-secondary" />
                  <h3 className="text-[15px] font-semibold text-text-primary">
                    System suggestion
                  </h3>
                  <span className="text-[11px] text-text-secondary ml-auto">
                    #{suggestion.id}
                  </span>
                </div>

                <div className="px-4 py-3 space-y-3 text-[13px]">
                  <p className="text-text-primary leading-relaxed">
                    {suggestion.summary}
                  </p>

                  {/* Constraint checklist */}
                  <AiChecklist constraints={suggestion.constraints} />

                  {/* Metadata */}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12.5px]">
                    <dt className="text-text-secondary">Confidence</dt>
                    <dd className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-surface-sunken overflow-hidden">
                        <div className="h-full bg-brand" style={{ width: `${suggestion.confidence}%` }} />
                      </div>
                      <span className="num font-medium">{suggestion.confidence}%</span>
                    </dd>
                    <dt className="text-text-secondary">Section</dt>
                    <dd className="num">{suggestion.section}</dd>
                    <dt className="text-text-secondary">Scheduled</dt>
                    <dd>{suggestion.scheduledTime}</dd>
                    {suggestion.notifyDepts && (
                      <>
                        <dt className="text-text-secondary">Notify depts</dt>
                        <dd className="font-medium">{suggestion.notifyDepts.join(", ")}</dd>
                      </>
                    )}
                  </dl>
                </div>

                {/* Actions */}
                <div className="px-4 py-2.5 border-t border-border-default flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors">
                    <ThumbsUp size={13} strokeWidth={2} />
                    Approve
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors">
                    <SlidersHorizontal size={13} strokeWidth={2} />
                    Adjust
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-critical hover:bg-critical/5 transition-colors">
                    <ThumbsDown size={13} strokeWidth={2} />
                    Reject
                  </button>
                  <Link href="/plan" className="ml-auto text-[12px] text-brand font-medium hover:underline flex items-center gap-1">
                    View in plan <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
