import { TopBar } from "@/components/layout";
import { Map } from "lucide-react";

export default function TwinPage() {
  return (
    <>
      <TopBar title="Digital twin" subtitle="Real-time track simulation and visualization" />
      <div className="flex-1 p-5">
        <div className="bg-surface border border-border-default p-6 text-center">
          <Map size={28} strokeWidth={1.5} className="text-text-secondary mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-text-primary mb-1">Digital twin simulator</h3>
          <p className="text-[13px] text-text-secondary">
            Geospatial map with track visualization and block simulation — implementation pending.
          </p>
        </div>
      </div>
    </>
  );
}
