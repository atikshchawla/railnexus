interface WeekDay {
  label: string;
  date: string;
  blocks: number;
  conflicts: number;
}

interface WeekViewProps {
  days: WeekDay[];
}

export default function WeekView({ days }: WeekViewProps) {
  return (
    <div className="grid grid-cols-7 gap-px bg-border-default border border-border-default">
      {days.map((day) => (
        <div
          key={day.date}
          className="bg-surface p-3 min-h-[120px] hover:bg-surface-sunken/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-text-secondary">
              {day.label}
            </span>
            <span className="text-[12px] font-semibold num">{day.date}</span>
          </div>
          <div className="space-y-1">
            {day.blocks > 0 && (
              <div className="text-[12px] text-text-primary">
                <span className="num font-medium">{day.blocks}</span>{" "}
                block{day.blocks !== 1 ? "s" : ""}
              </div>
            )}
            {day.conflicts > 0 && (
              <div className="text-[11px] text-critical font-medium">
                {day.conflicts} conflict{day.conflicts !== 1 ? "s" : ""}
              </div>
            )}
            {day.blocks === 0 && (
              <div className="text-[11px] text-text-secondary/50">No blocks</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
