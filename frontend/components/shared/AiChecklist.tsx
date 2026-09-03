import { Check, X } from "lucide-react";
import type { AiConstraint } from "@/lib/types";

interface AiChecklistProps {
  constraints: AiConstraint[];
}

export default function AiChecklist({ constraints }: AiChecklistProps) {
  return (
    <ul className="space-y-1">
      {constraints.map((c, i) => (
        <li key={i} className="flex items-start gap-2 text-[12.5px]">
          {c.met ? (
            <Check size={13} strokeWidth={2.5} className="text-success mt-0.5 shrink-0" />
          ) : (
            <X size={13} strokeWidth={2.5} className="text-critical mt-0.5 shrink-0" />
          )}
          <span className={c.met ? "text-text-primary" : "text-critical"}>
            {c.label}
            {c.detail && (
              <span className="text-text-secondary"> — {c.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
