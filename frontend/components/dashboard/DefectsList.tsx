export interface Defect {
  id: string;
  type: "IMR" | "OBS" | "PM";
  location: string;
  description: string;
  urgency: string;
  department: "Engg" | "TRD" | "S&T";
}

interface DefectsTableProps {
  defects: Defect[];
}

const severityStyle: Record<Defect["type"], string> = {
  IMR: "text-critical bg-critical/8",
  OBS: "text-warning bg-warning-bg",
  PM: "text-info bg-info/8",
};

export default function DefectsTable({ defects }: DefectsTableProps) {
  return (
    <div className="bg-surface border border-border-default overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h3 className="text-[15px] font-semibold text-text-primary">
          Recent defects
        </h3>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-sunken text-text-secondary text-left">
            <th className="px-4 py-2 font-medium">Severity</th>
            <th className="px-4 py-2 font-medium">ID</th>
            <th className="px-4 py-2 font-medium">Dept</th>
            <th className="px-4 py-2 font-medium">Location</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium text-right">Urgency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {defects.map((defect) => (
            <tr
              key={defect.id}
              className="hover:bg-surface-sunken/50 transition-colors cursor-pointer"
            >
              <td className="px-4 py-2">
                <span
                  className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 ${severityStyle[defect.type]}`}
                >
                  {defect.type}
                </span>
              </td>
              <td className="px-4 py-2 num text-text-secondary">
                {defect.id}
              </td>
              <td className="px-4 py-2 text-text-secondary">
                {defect.department}
              </td>
              <td className="px-4 py-2 num">{defect.location}</td>
              <td className="px-4 py-2">{defect.description}</td>
              <td className="px-4 py-2 text-right font-medium text-critical">
                {defect.urgency}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
