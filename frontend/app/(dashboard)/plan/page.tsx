"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout";
import { DateNav, DayTimeline, WeekView, MonthView } from "@/components/plan";
import { TrackMap } from "@/components/twin";
import { mockTimelineBlocks, mockTrainPaths } from "@/lib/mock-data";
import { Map } from "lucide-react";

type ViewTab = "day" | "week" | "month";

const mockWeekData = [
  { label: "Mon", date: "01", blocks: 3, conflicts: 1 },
  { label: "Tue", date: "02", blocks: 2, conflicts: 0 },
  { label: "Wed", date: "03", blocks: 4, conflicts: 2 },
  { label: "Thu", date: "04", blocks: 1, conflicts: 0 },
  { label: "Fri", date: "05", blocks: 3, conflicts: 1 },
  { label: "Sat", date: "06", blocks: 2, conflicts: 0 },
  { label: "Sun", date: "07", blocks: 0, conflicts: 0 },
];

const mockMonthData = {
  monthLabel: "September 2026",
  weeks: [
    {
      weekLabel: "W1",
      days: [
        { date: 1, blocks: 3, hasCritical: true },
        { date: 2, blocks: 2, hasCritical: false },
        { date: 3, blocks: 4, hasCritical: true },
        { date: 4, blocks: 1, hasCritical: false },
        { date: 5, blocks: 3, hasCritical: true },
        { date: 6, blocks: 2, hasCritical: false },
        { date: 7, blocks: 0, hasCritical: false },
      ],
    },
    {
      weekLabel: "W2",
      days: [
        { date: 8, blocks: 2, hasCritical: false },
        { date: 9, blocks: 1, hasCritical: false },
        { date: 10, blocks: 3, hasCritical: true },
        { date: 11, blocks: 2, hasCritical: false },
        { date: 12, blocks: 4, hasCritical: true },
        { date: 13, blocks: 1, hasCritical: false },
        { date: 14, blocks: 0, hasCritical: false },
      ],
    },
    {
      weekLabel: "W3",
      days: [
        { date: 15, blocks: 3, hasCritical: false },
        { date: 16, blocks: 2, hasCritical: false },
        { date: 17, blocks: 1, hasCritical: false },
        { date: 18, blocks: 5, hasCritical: true },
        { date: 19, blocks: 2, hasCritical: false },
        { date: 20, blocks: 3, hasCritical: true },
        { date: 21, blocks: 0, hasCritical: false },
      ],
    },
    {
      weekLabel: "W4",
      days: [
        { date: 22, blocks: 1, hasCritical: false },
        { date: 23, blocks: 2, hasCritical: false },
        { date: 24, blocks: 3, hasCritical: false },
        { date: 25, blocks: 2, hasCritical: false },
        { date: 26, blocks: 4, hasCritical: true },
        { date: 27, blocks: 1, hasCritical: false },
        { date: 28, blocks: 0, hasCritical: false },
      ],
    },
  ],
};

const mockTrackSections = [
  { id: "sec-1", from: "Ambala", to: "Sarsehri", kmStart: 238, kmEnd: 241, status: "Clear" as const },
  { id: "sec-2", from: "Sarsehri", to: "Naraingarh", kmStart: 241, kmEnd: 244, status: "Caution" as const },
  { id: "sec-3", from: "Naraingarh", to: "Barara", kmStart: 244, kmEnd: 248, status: "Block active" as const, activeBlock: "BLK-4521 (Engg)" },
  { id: "sec-4", from: "Barara", to: "Saharanpur", kmStart: 248, kmEnd: 252, status: "Clear" as const },
];

export default function BlockPlanPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>("day");
  const [showSchematic, setShowSchematic] = useState(false);

  return (
    <>
      <TopBar
        title="Block plan"
        subtitle="Section: Ambala–Saharanpur — all departments"
      />
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {/* Tab bar + date nav + schematic toggle */}
        <div className="flex items-center gap-4">
          <div className="flex bg-surface-sunken border border-border-default">
            {(["day", "week", "month"] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-[12.5px] font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <DateNav
            currentDate={
              activeTab === "day"
                ? "05 Sep 2026"
                : activeTab === "week"
                  ? "01–07 Sep 2026"
                  : "September 2026"
            }
            onPrev={() => {}}
            onNext={() => {}}
          />

          <button
            onClick={() => setShowSchematic(!showSchematic)}
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border transition-colors ${
              showSchematic
                ? "border-brand bg-brand/5 text-brand"
                : "border-border-default text-text-secondary hover:bg-surface-sunken"
            }`}
          >
            <Map size={13} strokeWidth={1.75} />
            Track schematic
          </button>
        </div>

        {/* Track schematic (toggle-able) */}
        {showSchematic && <TrackMap sections={mockTrackSections} />}

        {/* View content */}
        <div className="bg-surface border border-border-default p-4">
          {activeTab === "day" && (
            <>
              <div className="mb-3">
                <h3 className="text-[15px] font-semibold text-text-primary">
                  24-hour timeline — 05 Sep 2026
                </h3>
                <p className="text-[11px] text-text-secondary">
                  Km 238–252, Ambala–Saharanpur
                </p>
              </div>
              <DayTimeline blocks={mockTimelineBlocks} trains={mockTrainPaths} />
            </>
          )}

          {activeTab === "week" && (
            <>
              <div className="mb-3">
                <h3 className="text-[15px] font-semibold text-text-primary">
                  Week of 01–07 Sep 2026
                </h3>
              </div>
              <WeekView days={mockWeekData} />
            </>
          )}

          {activeTab === "month" && (
            <MonthView
              monthLabel={mockMonthData.monthLabel}
              weeks={mockMonthData.weeks}
            />
          )}
        </div>
      </div>
    </>
  );
}
