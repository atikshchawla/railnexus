"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface DateNavProps {
  currentDate: string;
  onPrev: () => void;
  onNext: () => void;
}

export default function DateNav({ currentDate, onPrev, onNext }: DateNavProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="p-1 rounded hover:bg-surface-sunken transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.75} className="text-text-secondary" />
      </button>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-sunken rounded min-w-[140px] justify-center">
        <CalendarDays size={13} strokeWidth={1.75} className="text-text-secondary" />
        <span className="text-[13px] font-medium text-text-primary">{currentDate}</span>
      </div>
      <button
        onClick={onNext}
        className="p-1 rounded hover:bg-surface-sunken transition-colors"
      >
        <ChevronRight size={16} strokeWidth={1.75} className="text-text-secondary" />
      </button>
    </div>
  );
}
