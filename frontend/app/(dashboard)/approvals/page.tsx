import { TopBar } from "@/components/layout";
import { CheckSquare } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <>
      <TopBar title="Approvals queue" subtitle="Review and approve pending block requests" />
      <div className="flex-1 p-5">
        <div className="bg-surface border border-border-default p-6 text-center">
          <CheckSquare size={28} strokeWidth={1.5} className="text-text-secondary mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-text-primary mb-1">Controller approvals</h3>
          <p className="text-[13px] text-text-secondary">
            Block request approval queue with approve, reject, and adjust actions — implementation pending.
          </p>
        </div>
      </div>
    </>
  );
}
