import type { MaintenanceRequest } from "@/lib/mock-approvals";
import { FileText, Send, Clock, CheckCircle } from "lucide-react";

interface MaintenanceTableProps {
  requests: MaintenanceRequest[];
}

const priorityStyle: Record<string, string> = {
  IMR: "text-critical bg-critical/8",
  OBS: "text-warning bg-warning-bg",
  PM: "text-info bg-info/8",
  Routine: "text-text-secondary bg-surface-sunken",
};

const statusConfig: Record<string, { label: string; className: string; Icon: typeof FileText }> = {
  Draft: { label: "Draft", className: "text-text-secondary", Icon: FileText },
  Submitted: { label: "Submitted", className: "text-info", Icon: Send },
  "Under review": { label: "Under review", className: "text-warning", Icon: Clock },
  Scheduled: { label: "Scheduled", className: "text-success", Icon: CheckCircle },
};

export default function MaintenanceTable({ requests }: MaintenanceTableProps) {
  return (
    <div className="bg-surface border border-border-default overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-sunken text-text-secondary text-left">
            <th className="px-4 py-2 font-medium">Priority</th>
            <th className="px-4 py-2 font-medium">Request ID</th>
            <th className="px-4 py-2 font-medium">Dept</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium">Section</th>
            <th className="px-4 py-2 font-medium">Requested date</th>
            <th className="px-4 py-2 font-medium">Duration</th>
            <th className="px-4 py-2 font-medium">Submitted by</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {requests.map((req) => {
            const status = statusConfig[req.status];
            const StatusIcon = status.Icon;
            return (
              <tr
                key={req.id}
                className="hover:bg-surface-sunken/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-2">
                  <span
                    className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${priorityStyle[req.priority]}`}
                  >
                    {req.priority}
                  </span>
                </td>
                <td className="px-4 py-2 num font-medium">{req.id}</td>
                <td className="px-4 py-2 text-text-secondary">
                  {req.department}
                </td>
                <td className="px-4 py-2 max-w-[260px] truncate">
                  {req.description}
                </td>
                <td className="px-4 py-2 num text-[12px]">{req.section}</td>
                <td className="px-4 py-2 num text-[12px]">
                  {req.requestedDate}
                </td>
                <td className="px-4 py-2 num">{req.requestedDuration}</td>
                <td className="px-4 py-2 text-[12px] text-text-secondary">
                  {req.submittedBy}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${status.className}`}>
                    <StatusIcon size={12} strokeWidth={2} />
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
