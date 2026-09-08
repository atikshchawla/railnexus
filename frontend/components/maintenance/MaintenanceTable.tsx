import type { BacklogItem } from "@/lib/types";
import { FileText, Send, Clock, CheckCircle } from "lucide-react";

interface MaintenanceTableProps {
  requests: BacklogItem[];
}

const priorityStyle: Record<string, string> = {
  IMR: "badge-imr",
  OBS: "badge-obs",
  PM: "badge-pm",
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
            <th scope="col" className="px-4 py-2 font-medium">Priority</th>
            <th scope="col" className="px-4 py-2 font-medium">Request ID</th>
            <th scope="col" className="px-4 py-2 font-medium">Dept</th>
            <th scope="col" className="px-4 py-2 font-medium">Description</th>
            <th scope="col" className="px-4 py-2 font-medium">Location</th>
            <th scope="col" className="px-4 py-2 font-medium">Last Synced</th>
            <th scope="col" className="px-4 py-2 font-medium">Deadline</th>
            <th scope="col" className="px-4 py-2 font-medium">Source</th>
            <th scope="col" className="px-4 py-2 font-medium">Status</th>
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
                    className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${priorityStyle[req.category]}`}
                  >
                    {req.category}
                  </span>
                </td>
                <td className="px-4 py-2 num font-medium">{req.id}</td>
                <td className="px-4 py-2 text-text-secondary">
                  {req.department}
                </td>
                <td className="px-4 py-2 max-w-[260px] truncate">
                  {req.description}
                </td>
                <td className="px-4 py-2 num text-[12px]">{req.location}</td>
                <td className="px-4 py-2 num text-[12px]">
                  {req.provenance.lastSynced}
                </td>
                <td className="px-4 py-2 num">{req.urgency.deadline}</td>
                <td className="px-4 py-2 text-[12px] text-text-secondary">
                  {req.provenance.system}
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
