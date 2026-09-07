import { MapPin, Signal, CircleDot } from "lucide-react";

interface TrackSection {
  id: string;
  from: string;
  to: string;
  kmStart: number;
  kmEnd: number;
  status: "Clear" | "Block active" | "Caution";
  activeBlock?: string;
}

interface TrackMapProps {
  sections: TrackSection[];
}

const statusStyle: Record<string, { bg: string; text: string; signal: string }> = {
  Clear: { bg: "bg-success/8", text: "text-success", signal: "text-success" },
  "Block active": { bg: "bg-critical/8", text: "text-critical", signal: "text-critical" },
  Caution: { bg: "bg-warning/8", text: "text-warning", signal: "text-warning" },
};

export default function TrackMap({ sections }: TrackMapProps) {
  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h3 className="text-[15px] font-semibold text-text-primary">
          Track schematic
        </h3>
        <p className="text-[11px] text-text-secondary">
          Ambala Cantt–Saharanpur section, UP line
        </p>
      </div>

      <div className="px-4 py-4">
        {/* Track line visualization */}
        <div className="relative">
          {sections.map((section, i) => {
            const style = statusStyle[section.status];
            return (
              <div key={section.id} className="flex items-stretch mb-0">
                {/* Station node */}
                <div className="flex flex-col items-center w-20 shrink-0">
                  <div className="flex items-center gap-1">
                    <Signal size={12} strokeWidth={2} className={style.signal} />
                  </div>
                  <span className="text-[11px] font-medium text-text-primary mt-0.5">
                    {section.from}
                  </span>
                  <span className="text-[10px] num text-text-secondary">
                    Km {section.kmStart}
                  </span>
                </div>

                {/* Track segment */}
                <div className="flex-1 flex flex-col justify-center py-2">
                  <div className={`relative h-6 ${style.bg} border border-border-default flex items-center px-3`}>
                    {/* Track rail lines */}
                    <div className="absolute inset-x-0 top-[11px] border-t border-dashed border-border-default" />
                    <div className="absolute inset-x-0 top-[15px] border-t border-dashed border-border-default" />

                    <span className={`relative text-[10px] font-medium ${style.text} z-10`}>
                      {section.status}
                      {section.activeBlock && ` — ${section.activeBlock}`}
                    </span>
                  </div>
                </div>

                {/* End station node (only for last section) */}
                {i === sections.length - 1 && (
                  <div className="flex flex-col items-center w-20 shrink-0">
                    <div className="flex items-center gap-1">
                      <Signal size={12} strokeWidth={2} className={style.signal} />
                    </div>
                    <span className="text-[11px] font-medium text-text-primary mt-0.5">
                      {section.to}
                    </span>
                    <span className="text-[10px] num text-text-secondary">
                      Km {section.kmEnd}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border-default">
          {Object.entries(statusStyle).map(([status, style]) => (
            <div key={status} className="flex items-center gap-1.5">
              <CircleDot size={10} className={style.text} />
              <span className="text-[11px] text-text-secondary">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
