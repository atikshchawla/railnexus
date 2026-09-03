import { TopBar } from "@/components/layout";
import {
  AlertBanner,
  KpiCard,
  DefectsTable,
  AiProposalCard,
} from "@/components/dashboard";
import { mockDefects, mockProposal, mockKpis } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Section: Ambala–Saharanpur, Northern Railway"
      />

      {/* Critical alert — solid, top of content */}
      <AlertBanner
        message="2 new defects detected in your section — 1 IMR requires urgent attention"
        type="critical"
      />

      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-px bg-border-default border border-border-default">
          {mockKpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Defects table */}
        <DefectsTable defects={mockDefects} />

        {/* System suggestion — visually same weight as the table above */}
        <AiProposalCard proposal={mockProposal} />
      </div>
    </>
  );
}
