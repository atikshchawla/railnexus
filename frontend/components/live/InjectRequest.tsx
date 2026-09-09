"use client";

import { useState } from "react";
import { FlaskConical, Send } from "lucide-react";
import {
  injectRequest,
  type Department,
  type RequestType,
  type SectionReflection,
} from "@/lib/live";

const typeLabel: Record<RequestType, string> = {
  running_status: "Running status",
  section_entry: "Section entry",
  maintenance_block: "Maintenance block",
};

interface InjectRequestProps {
  sections: SectionReflection[];
  onInjected: () => void;
}

export default function InjectRequest({ sections, onInjected }: InjectRequestProps) {
  const [department, setDepartment] = useState<Department>("TDMS");
  const [type, setType] = useState<RequestType>("section_entry");
  const [sectionId, setSectionId] = useState<string>("");
  const [trainId, setTrainId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveSectionId = sectionId || sections[0]?.id || "";

  const handleRaise = async () => {
    if (!effectiveSectionId || busy) return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const result = await injectRequest({
        department,
        type,
        sectionId: effectiveSectionId,
        trainId: trainId.trim() || undefined,
      });
      setOutcome(
        `${result.request.id} → ${result.decision.decision} (${result.decision.sectionId}: ${result.decision.sectionState})`,
      );
      onInjected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inject failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
        <FlaskConical size={14} strokeWidth={1.75} className="text-brand" />
        <h3 className="text-[15px] font-semibold text-text-primary">Query injector</h3>
        <span className="ml-auto text-[11px] text-text-secondary">
          judge-raised, judged like any auto request
        </span>
      </div>

      <div className="px-4 py-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-text-secondary mb-1">Department</label>
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value as Department)}
            className="text-[12.5px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            <option value="TMS">TMS — Movement</option>
            <option value="TDMS">TDMS — Traction</option>
            <option value="SMMS">SMMS — Track</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-text-secondary mb-1">Type</label>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as RequestType)}
            className="text-[12.5px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary"
          >
            {(Object.keys(typeLabel) as RequestType[]).map((key) => (
              <option key={key} value={key}>
                {typeLabel[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-text-secondary mb-1">Section</label>
          <select
            value={effectiveSectionId}
            onChange={(event) => setSectionId(event.target.value)}
            disabled={sections.length === 0}
            className="text-[12.5px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary disabled:opacity-50"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.id} · Km {section.fromKm}–{section.toKm}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-text-secondary mb-1">Train ID (opt.)</label>
          <input
            type="text"
            value={trainId}
            onChange={(event) => setTrainId(event.target.value)}
            placeholder="e.g. SPL-9"
            className="w-36 text-[12.5px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary placeholder:text-text-secondary/50"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleRaise()}
          disabled={!effectiveSectionId || busy}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 py-1.5 bg-brand text-white disabled:opacity-50"
        >
          <Send size={12} strokeWidth={2} />
          {busy ? "Raising…" : "Raise request"}
        </button>
      </div>

      {outcome && (
        <div className="px-4 pb-3 text-[12px]">
          <span className="num text-text-primary">{outcome}</span>
        </div>
      )}

      {error && <div className="px-4 pb-3 text-[12px] font-medium text-critical">{error}</div>}
    </div>
  );
}