import { TopBar } from "@/components/layout";
import { MaintenanceTable, BlockRequestForm } from "@/components/maintenance";
import { mockMaintenanceRequests } from "@/lib/mock-approvals";

export default function MaintenancePage() {
  return (
    <>
      <TopBar
        title="Maintenance requests"
        subtitle="Submit and track block requests for your section"
      />
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        <BlockRequestForm />
        <MaintenanceTable requests={mockMaintenanceRequests} />
      </div>
    </>
  );
}
