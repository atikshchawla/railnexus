import { TopBar } from "@/components/layout";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <>
      <TopBar title="Maintenance requests" subtitle="View and manage block requests" />
      <div className="flex-1 p-5">
        <div className="bg-surface border border-border-default p-6 text-center">
          <Wrench size={28} strokeWidth={1.5} className="text-text-secondary mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-text-primary mb-1">Maintenance module</h3>
          <p className="text-[13px] text-text-secondary">
            Block request submission and management interface — implementation pending.
          </p>
        </div>
      </div>
    </>
  );
}
