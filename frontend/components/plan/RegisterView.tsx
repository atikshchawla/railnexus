"use client";

import { useState, useMemo } from "react";
import type { ChartBlock, TrainPath, DerivedConflict } from "@/lib/types";
import { formatTime, getDeptColor, PRIORITY_BORDER } from "@/lib/chart-engine";

interface RegisterViewProps {
  blocks: ChartBlock[];
  trains: TrainPath[];
  conflicts: DerivedConflict[];
  onFocusElement: (id: string, type: "block" | "train" | "conflict") => void;
}

type SortKey = "id" | "type" | "department" | "km" | "time" | "status" | "priority";
type SortDir = "asc" | "desc";

interface RegisterRow {
  id: string;
  rowType: "block" | "train" | "conflict";
  department: string;
  description: string;
  kmRange: string;
  timeWindow: string;
  status: string;
  priorityTier: string;
  conflictCount: number;
  sortKm: number;
  sortTime: number;
}

export default function RegisterView({ blocks, trains, conflicts, onFocusElement }: RegisterViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows: RegisterRow[] = useMemo(() => {
    const result: RegisterRow[] = [];

    for (const b of blocks) {
      const relConflicts = conflicts.filter(c => c.blockId === b.id || c.otherBlockId === b.id);
      result.push({
        id: b.id,
        rowType: "block",
        department: b.department,
        description: `${b.label}${b.isShadow ? " [SHADOW]" : ""}`,
        kmRange: `${b.km_start}–${b.km_end}`,
        timeWindow: `${formatTime(b.time_start)}–${formatTime(b.time_end)}`,
        status: b.status,
        priorityTier: b.priorityTier,
        conflictCount: relConflicts.length,
        sortKm: b.km_start,
        sortTime: b.time_start,
      });
    }

    for (const t of trains) {
      const relConflicts = conflicts.filter(c => c.trainId === t.id);
      const firstStop = t.stops[0];
      const lastStop = t.stops[t.stops.length - 1];
      result.push({
        id: t.id,
        rowType: "train",
        department: "—",
        description: `${t.name} (${t.type})`,
        kmRange: firstStop && lastStop ? `${firstStop.km}–${lastStop.km}` : "—",
        timeWindow: firstStop && lastStop ? `${formatTime(firstStop.time)}–${formatTime(lastStop.time)}` : "—",
        status: "—",
        priorityTier: relConflicts.length > 0 ? "P2-high" : "P4-low",
        conflictCount: relConflicts.length,
        sortKm: firstStop?.km ?? 0,
        sortTime: firstStop?.time ?? 0,
      });
    }

    for (const c of conflicts) {
      result.push({
        id: c.id,
        rowType: "conflict",
        department: "—",
        description: c.affectedBlockDesc ?? `${c.blockId} vs ${c.trainId ?? c.otherBlockId}`,
        kmRange: `${c.km_start}–${c.km_end}`,
        timeWindow: `${formatTime(c.time_start)}–${formatTime(c.time_end)}`,
        status: `${c.overlap_minutes}m overlap`,
        priorityTier: c.priorityTier,
        conflictCount: 0,
        sortKm: c.km_start,
        sortTime: c.time_start,
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "id": cmp = a.id.localeCompare(b.id); break;
        case "type": cmp = a.rowType.localeCompare(b.rowType); break;
        case "department": cmp = a.department.localeCompare(b.department); break;
        case "km": cmp = a.sortKm - b.sortKm; break;
        case "time": cmp = a.sortTime - b.sortTime; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "priority": cmp = a.priorityTier.localeCompare(b.priorityTier); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [blocks, trains, conflicts, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th scope="col"
      className="px-3 py-2 font-medium cursor-pointer hover:text-text-primary select-none"
      onClick={() => toggleSort(k)}>
      {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  const typeStyle: Record<string, string> = {
    block: "text-info bg-info/8",
    train: "text-text-secondary bg-surface-sunken",
    conflict: "text-critical bg-critical/8",
  };

  return (
    <div className="flex-1 overflow-auto bg-surface border border-border-default">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-surface-sunken text-text-secondary text-left sticky top-0 z-10">
            <SortHeader k="id" label="ID" />
            <SortHeader k="type" label="Type" />
            <SortHeader k="department" label="Dept" />
            <th scope="col" className="px-3 py-2 font-medium">Description</th>
            <SortHeader k="km" label="Km range" />
            <SortHeader k="time" label="Time" />
            <SortHeader k="status" label="Status" />
            <SortHeader k="priority" label="Priority" />
            <th scope="col" className="px-3 py-2 font-medium">Conflicts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {rows.map(row => (
            <tr key={`${row.rowType}-${row.id}`}
              className="hover:bg-surface-sunken/50 cursor-pointer transition-colors"
              onClick={() => onFocusElement(row.id, row.rowType)}>
              <td className="px-3 py-2 num font-medium">{row.id}</td>
              <td className="px-3 py-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 uppercase ${typeStyle[row.rowType]}`}>
                  {row.rowType}
                </span>
              </td>
              <td className="px-3 py-2">
                {row.department !== "—" ? (
                  <span style={{ color: getDeptColor(row.department) }} className="font-medium">{row.department}</span>
                ) : "—"}
              </td>
              <td className="px-3 py-2 max-w-[200px] truncate">{row.description}</td>
              <td className="px-3 py-2 num">{row.kmRange}</td>
              <td className="px-3 py-2 num">{row.timeWindow}</td>
              <td className="px-3 py-2 text-text-secondary">{row.status}</td>
              <td className="px-3 py-2">
                <span style={{ color: PRIORITY_BORDER[row.priorityTier as keyof typeof PRIORITY_BORDER]?.color }}>
                  {row.priorityTier}
                </span>
              </td>
              <td className="px-3 py-2">
                {row.conflictCount > 0 ? (
                  <span className="text-critical font-semibold">{row.conflictCount}</span>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
