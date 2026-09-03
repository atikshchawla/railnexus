import { Cpu, ThumbsUp, ThumbsDown, SlidersHorizontal } from "lucide-react";

export interface Proposal {
  id: string;
  summary: string;
  confidence: number;
  shadowBlocks: string[];
  trainsAffected: { passenger: number; freight: number };
  section: string;
  scheduledTime: string;
  department: "Engg" | "TRD" | "S&T";
}

interface AiProposalCardProps {
  proposal: Proposal;
}

export default function AiProposalCard({ proposal }: AiProposalCardProps) {
  return (
    <div className="bg-surface border border-border-default">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
        <Cpu size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="text-[15px] font-semibold text-text-primary">
          System suggestion
        </h3>
        <span className="text-[11px] text-text-secondary ml-auto">
          #{proposal.id}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3 text-[13px]">
        <p className="text-text-primary leading-relaxed">
          {proposal.summary}
        </p>

        {/* Metadata table */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12.5px]">
          <dt className="text-text-secondary">Confidence</dt>
          <dd className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-surface-sunken overflow-hidden">
              <div
                className="h-full bg-brand"
                style={{ width: `${proposal.confidence}%` }}
              />
            </div>
            <span className="num font-medium">{proposal.confidence}%</span>
          </dd>

          <dt className="text-text-secondary">Section</dt>
          <dd className="num">{proposal.section}</dd>

          <dt className="text-text-secondary">Scheduled</dt>
          <dd>{proposal.scheduledTime}</dd>

          <dt className="text-text-secondary">Shadow blocks</dt>
          <dd>{proposal.shadowBlocks.join(", ") || "None"}</dd>

          <dt className="text-text-secondary">Trains affected</dt>
          <dd className="num">
            {proposal.trainsAffected.passenger} passenger,{" "}
            {proposal.trainsAffected.freight} freight
          </dd>
        </dl>
      </div>

      {/* Actions */}
      <div className="px-4 py-2.5 border-t border-border-default flex items-center gap-2">
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors">
          <ThumbsUp size={13} strokeWidth={2} />
          Approve
        </button>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-primary hover:bg-surface-sunken transition-colors">
          <SlidersHorizontal size={13} strokeWidth={2} />
          Adjust timing
        </button>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-critical hover:bg-critical/5 transition-colors">
          <ThumbsDown size={13} strokeWidth={2} />
          Reject
        </button>
      </div>
    </div>
  );
}
