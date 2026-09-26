"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface DateNavProps {
  currentDate?: string;
  onDateChange?: (dateStr: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

// Timezone-safe date helper functions
function parseToYMD(input: string): { year: number; month: number; day: number } {
  if (!input) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
  const ymdMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return {
      year: parseInt(ymdMatch[1], 10),
      month: parseInt(ymdMatch[2], 10),
      day: parseInt(ymdMatch[3], 10),
    };
  }

  // Handle formats like "04 Sep 2026", "04 Sept 2026", etc.
  const cleaned = input.replace(/Sept/i, "Sep");
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function ymdToIso({ year, month, day }: { year: number; month: number; day: number }): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ymdToDisplay({ year, month, day }: { year: number; month: number; day: number }): string {
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function addDays(iso: string, days: number): string {
  const { year, month, day } = parseToYMD(iso);
  const d = new Date(year, month - 1, day + days);
  return ymdToIso({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  });
}

function getTodayIso(): string {
  const d = new Date();
  return ymdToIso({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
}

export default function DateNav({
  currentDate,
  onDateChange,
  onPrev,
  onNext,
}: DateNavProps) {
  const [dateValue, setDateValue] = useState(() =>
    currentDate ? ymdToIso(parseToYMD(currentDate)) : getTodayIso()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if external currentDate changes
  useEffect(() => {
    if (currentDate) {
      const nextIso = ymdToIso(parseToYMD(currentDate));
      setDateValue(nextIso);
    }
  }, [currentDate]);

  const handlePrev = () => {
    const newIso = addDays(dateValue, -1);
    setDateValue(newIso);
    const displayStr = ymdToDisplay(parseToYMD(newIso));
    onDateChange?.(displayStr);
    onPrev?.();
  };

  const handleNext = () => {
    const newIso = addDays(dateValue, 1);
    setDateValue(newIso);
    const displayStr = ymdToDisplay(parseToYMD(newIso));
    onDateChange?.(displayStr);
    onNext?.();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    setDateValue(newDate);
    const displayStr = ymdToDisplay(parseToYMD(newDate));
    onDateChange?.(displayStr);
  };

  const handleContainerClick = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.focus();
    }
  };

  const currentDisplay = ymdToDisplay(parseToYMD(dateValue));

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Date navigation">
      <button
        type="button"
        onClick={handlePrev}
        className="p-1 rounded hover:bg-surface-sunken transition-colors text-text-secondary hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
        title="Previous day"
        aria-label="Previous day"
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>

      <div
        onClick={handleContainerClick}
        className="relative flex items-center gap-1.5 px-3 py-1 bg-surface-sunken border border-border-default rounded min-w-[145px] justify-center hover:bg-surface hover:border-text-secondary/40 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-brand"
        title="Click to select date"
      >
        <CalendarDays size={13} strokeWidth={1.75} className="text-text-secondary" />
        <span className="text-[13px] font-medium text-text-primary select-none">{currentDisplay}</span>
        <input
          ref={inputRef}
          type="date"
          value={dateValue}
          onChange={handleDateChange}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label="Select Date"
        />
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="p-1 rounded hover:bg-surface-sunken transition-colors text-text-secondary hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
        title="Next day"
        aria-label="Next day"
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
