import { TopBar } from "@/components/layout";
import { TimelineSlider, TrackMap } from "@/components/twin";
import { mockTrainPaths } from "@/lib/mock-approvals";

const mockTimelineBlocks = [
  { id: "BLK-4521", label: "Engg: Rail repair", startHour: 14, endHour: 16, department: "Engg" as const },
  { id: "BLK-4518", label: "Engg: OHE dropper", startHour: 8, endHour: 9.5, department: "Engg" as const },
  { id: "BLK-SHADOW-1", label: "TRD: OHE inspection (shadow)", startHour: 14, endHour: 15.5, department: "TRD" as const },
  { id: "BLK-4520", label: "S&T: Relay replacement", startHour: 10, endHour: 12.5, department: "S&T" as const },
];

const mockTrackSections = [
  { id: "sec-1", from: "Ambala", to: "Sarsehri", kmStart: 238, kmEnd: 241, status: "Clear" as const },
  { id: "sec-2", from: "Sarsehri", to: "Naraingarh", kmStart: 241, kmEnd: 244, status: "Caution" as const },
  { id: "sec-3", from: "Naraingarh", to: "Barara", kmStart: 244, kmEnd: 248, status: "Block active" as const, activeBlock: "BLK-4521 (Engg)" },
  { id: "sec-4", from: "Barara", to: "Saharanpur", kmStart: 248, kmEnd: 252, status: "Clear" as const },
];

export default function TwinPage() {
  return (
    <>
      <TopBar
        title="Digital twin"
        subtitle="Real-time track simulation — Ambala–Saharanpur section"
      />
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        <TrackMap sections={mockTrackSections} />
        <TimelineSlider blocks={mockTimelineBlocks} trains={mockTrainPaths} />
      </div>
    </>
  );
}
