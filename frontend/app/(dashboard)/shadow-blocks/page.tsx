import { TopBar } from "@/components/layout";
import { Layers } from "lucide-react";

export default function ShadowBlocksPage() {
  return (
    <>
      <TopBar title="Shadow blocks" subtitle="Optimize multi-department block utilization" />
      <div className="flex-1 p-5">
        <div className="bg-surface border border-border-default p-6 text-center">
          <Layers size={28} strokeWidth={1.5} className="text-text-secondary mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-text-primary mb-1">Shadow block optimizer</h3>
          <p className="text-[13px] text-text-secondary">
            Consolidated possession scheduling and shadow block visualization — implementation pending.
          </p>
        </div>
      </div>
    </>
  );
}
