import { TopBar } from "@/components/layout";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const metrics = [
  {
    label: "Shadow block utilization",
    current: "38%",
    baseline: "12%",
    change: "+26pp",
    positive: true,
    description: "% of blocks that include shadow department work",
  },
  {
    label: "Average block downtime",
    current: "2.1 hrs",
    baseline: "3.4 hrs",
    change: "-38%",
    positive: true,
    description: "Mean duration per maintenance block",
  },
  {
    label: "Cross-dept conflict rate",
    current: "8%",
    baseline: "34%",
    change: "-26pp",
    positive: true,
    description: "% of blocks with unresolved scheduling conflicts",
  },
  {
    label: "Plan adherence",
    current: "91%",
    baseline: "67%",
    change: "+24pp",
    positive: true,
    description: "% of scheduled blocks executed as planned",
  },
  {
    label: "IMR SLA compliance",
    current: "97%",
    baseline: "82%",
    change: "+15pp",
    positive: true,
    description: "% of IMR defects repaired within 3-day SLA",
  },
  {
    label: "Corridor availability",
    current: "94%",
    baseline: "89%",
    change: "+5pp",
    positive: true,
    description: "% of time track is available for traffic",
  },
];

export default function AnalyticsPage() {
  return (
    <>
      <TopBar
        title="Analytics"
        subtitle="Performance comparison: RailNexus ABP vs decentralized BDMS baseline"
      />
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {/* Summary banner */}
        <div className="bg-surface border border-border-default px-4 py-3">
          <p className="text-[13px] text-text-primary">
            Comparing <span className="font-semibold">RailNexus ABP (AI-driven centralized planning)</span> against the
            previous <span className="font-semibold">decentralized BDMS process</span> across
            the Ambala–Saharanpur section over the last 4 weeks.
          </p>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-px bg-border-default border border-border-default">
          {metrics.map((m) => (
            <div key={m.label} className="bg-surface p-4">
              <p className="text-[12.5px] text-text-secondary mb-2">{m.label}</p>
              <div className="flex items-end gap-3 mb-1">
                <div>
                  <p className="text-[10px] text-text-secondary mb-0.5">Current</p>
                  <p className="text-[24px] font-semibold text-text-primary leading-none num">{m.current}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-secondary mb-0.5">Baseline</p>
                  <p className="text-[18px] font-medium text-text-secondary leading-none num">{m.baseline}</p>
                </div>
                <div className={`flex items-center gap-0.5 text-[12px] font-semibold mb-0.5 ${m.positive ? "text-success" : "text-critical"}`}>
                  {m.positive ? <ArrowUp size={12} strokeWidth={2.5} /> : <ArrowDown size={12} strokeWidth={2.5} />}
                  {m.change}
                </div>
              </div>
              <p className="text-[11px] text-text-secondary">{m.description}</p>
            </div>
          ))}
        </div>

        {/* Department breakdown */}
        <div className="bg-surface border border-border-default">
          <div className="px-4 py-2.5 border-b border-border-default">
            <h3 className="text-[15px] font-semibold text-text-primary">
              Department coordination efficiency
            </h3>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-sunken text-text-secondary text-left">
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Blocks this month</th>
                <th className="px-4 py-2 font-medium">Shadow blocks joined</th>
                <th className="px-4 py-2 font-medium">Conflicts raised</th>
                <th className="px-4 py-2 font-medium">Conflicts resolved</th>
                <th className="px-4 py-2 font-medium">Avg response time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              <tr className="hover:bg-surface-sunken/50">
                <td className="px-4 py-2 font-medium">Engineering</td>
                <td className="px-4 py-2 num">18</td>
                <td className="px-4 py-2 num">7</td>
                <td className="px-4 py-2 num">4</td>
                <td className="px-4 py-2 num">3</td>
                <td className="px-4 py-2 num">1.2 hrs</td>
              </tr>
              <tr className="hover:bg-surface-sunken/50">
                <td className="px-4 py-2 font-medium">TRD</td>
                <td className="px-4 py-2 num">12</td>
                <td className="px-4 py-2 num">5</td>
                <td className="px-4 py-2 num">3</td>
                <td className="px-4 py-2 num">3</td>
                <td className="px-4 py-2 num">0.8 hrs</td>
              </tr>
              <tr className="hover:bg-surface-sunken/50">
                <td className="px-4 py-2 font-medium">S&T</td>
                <td className="px-4 py-2 num">8</td>
                <td className="px-4 py-2 num">3</td>
                <td className="px-4 py-2 num">2</td>
                <td className="px-4 py-2 num">1</td>
                <td className="px-4 py-2 num">1.5 hrs</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
