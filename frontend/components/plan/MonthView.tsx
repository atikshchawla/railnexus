interface MonthWeek {
  weekLabel: string;
  days: {
    date: number;
    blocks: number;
    hasCritical: boolean;
  }[];
}

interface MonthViewProps {
  weeks: MonthWeek[];
  monthLabel: string;
}

export default function MonthView({ weeks, monthLabel }: MonthViewProps) {
  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h3 className="text-[15px] font-semibold text-text-primary">
          {monthLabel}
        </h3>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-border-default">
        <div className="bg-surface-sunken px-2 py-1.5 text-[11px] text-text-secondary font-medium">
          Week
        </div>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="bg-surface-sunken px-2 py-1.5 text-[11px] text-text-secondary font-medium text-center"
          >
            {d}
          </div>
        ))}

        {/* Week rows */}
        {weeks.map((week) => (
          <>
            <div
              key={`label-${week.weekLabel}`}
              className="bg-surface px-2 py-2 text-[11px] text-text-secondary font-medium flex items-center"
            >
              {week.weekLabel}
            </div>
            {week.days.map((day, i) => (
              <div
                key={`${week.weekLabel}-${i}`}
                className="bg-surface px-2 py-2 text-center hover:bg-surface-sunken/30 transition-colors cursor-pointer min-h-[48px]"
              >
                {day.date > 0 && (
                  <>
                    <div className="text-[12px] num">{day.date}</div>
                    {day.blocks > 0 && (
                      <div
                        className={`text-[10px] mt-0.5 font-medium ${
                          day.hasCritical ? "text-critical" : "text-brand"
                        }`}
                      >
                        {day.blocks} blk
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  );
}
