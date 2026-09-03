import { TopBar } from "@/components/layout";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <>
      <TopBar title="Analytics" subtitle="Block performance and efficiency metrics" />
      <div className="flex-1 p-5">
        <div className="bg-surface border border-border-default p-6 text-center">
          <BarChart3 size={28} strokeWidth={1.5} className="text-text-secondary mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-text-primary mb-1">Analytics dashboard</h3>
          <p className="text-[13px] text-text-secondary">
            Shadow utilization rates, block efficiency, and 26-week programme analytics — implementation pending.
          </p>
        </div>
      </div>
    </>
  );
}
