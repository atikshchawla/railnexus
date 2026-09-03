import { TopBar } from "@/components/layout";
import { ApprovalsTable } from "@/components/approvals";
import { mockBlockRequests } from "@/lib/mock-approvals";

export default function ApprovalsPage() {
  const pendingCount = mockBlockRequests.filter(
    (r) => r.status === "Pending"
  ).length;

  return (
    <>
      <TopBar
        title="Approvals queue"
        subtitle={`${pendingCount} pending requests — sorted by priority`}
      />
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        <ApprovalsTable requests={mockBlockRequests} />
      </div>
    </>
  );
}
