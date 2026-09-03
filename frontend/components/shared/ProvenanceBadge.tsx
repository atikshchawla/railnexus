import { Database, RefreshCw } from "lucide-react";
import type { Provenance } from "@/lib/types";

interface ProvenanceBadgeProps {
  provenance: Provenance;
}

const systemLabel: Record<string, string> = {
  TMS: "Track Mgmt",
  SMMS: "Signal Maint",
  TDMS: "Telecom/Data",
  COA: "Corridor Avail",
  Manual: "Manual entry",
};

export default function ProvenanceBadge({ provenance }: ProvenanceBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
      <Database size={10} strokeWidth={1.75} />
      <span className="font-medium">{provenance.system}</span>
      <span className="text-text-secondary/60">·</span>
      <RefreshCw size={9} strokeWidth={1.75} />
      <span>{provenance.lastSynced}</span>
    </span>
  );
}
