"use client";

import { useEffect, useState } from "react";
import {
  CircleDot,
  Radio,
  RefreshCw,
  Route,
  Signal,
  Train,
  Wrench,
} from "lucide-react";
import { AlertBanner } from "@/components/dashboard";
import InjectRequest from "@/components/live/InjectRequest";
import {
  fetchLiveState,
  formatClock,
  type AbpDecision,
  type AbpRequest,
  type DecisionValue,
  type Department,
  type LiveState,
  type RequestType,
  type SectionState,
} from "@/lib/live";

const POLL_MS = 2500;

const sectionStateStyle: Record<SectionState, { text: string; dot: string; segment: string }> = {
  Clear: { text: "text-success", dot: "bg-success", segment: "bg-success/8 border-success/40" },
  Caution: { text: "text-warning", dot: "bg-warning", segment: "bg-warning-bg border-warning/40" },
  "Block active": { text: "text-critical", dot: "bg-critical", segment: "bg-critical/8 border-critical/40" },
  Approved: { text: "text-info", dot: "bg-info", segment: "bg-info/8 border-info/40" },
  Reserved: { text: "text-info", dot: "bg-info", segment: "bg-info/8 border-info/40" },
  Queued: { text: "text-warning", dot: "bg-warning", segment: "bg-warning-bg border-warning/40" },
  Rerouted: { text: "text-warning", dot: "bg-warning", segment: "bg-warning-bg border-warning/40" },
};

const sectionStateOrder: SectionState[] = [
  "Clear",
  "Caution",
  "Approved",
  "Reserved",
  "Queued",
  "Block active",
  "Rerouted",
];

const decisionStyle: Record<DecisionValue, string> = {
  approved: "bg-success/8 text-success",
  reserved: "bg-info/8 text-info",
  queued: "bg-warning-bg text-warning",
  rerouted: "bg-warning-bg text-warning",
  rejected: "bg-critical/8 text-critical",
};

const typeStyle: Record<RequestType, string> = {
  running_status: "bg-info/8 text-info",
  section_entry: "bg-brand/8 text-brand",
  maintenance_block: "bg-warning-bg text-warning",
};

const typeLabel: Record<RequestType, string> = {
  running_status: "Run status",
  section_entry: "Section entry",
  maintenance_block: "Maint block",
};

const departments: { key: Department; label: string; sub: string; icon: typeof Train }[] = [
  { key: "TMS", label: "TMS — Movement", sub: "delayed running-status requests", icon: Train },
  { key: "TDMS", label: "TDMS — Traction", sub: "section block-entry requests", icon: Route },
  { key: "SMMS", label: "SMMS — Track", sub: "maintenance-block requests", icon: Wrench },
];

function SectionSchematic({ sections }: { sections: LiveState["sections"] }) {
  const shownStates = sectionStateOrder.filter((s) =>
    sections.some((section) => section.state === s),
  );

  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h3 className="text-[15px] font-semibold text-text-primary">Section schematic</h3>
        <p className="text-[11px] text-text-secondary">
          Ambala Cantt–Saharanpur, UP line — reflected ABP states
        </p>
      </div>

      <div className="px-4 py-4">
        <div className="relative">
          {sections.map((section, i) => {
            const style = sectionStateStyle[section.state];
            const last = i === sections.length - 1;
            return (
              <div key={section.id} className="flex items-stretch">
                <div className="flex flex-col items-center w-20 shrink-0">
                  <Signal size={12} strokeWidth={2} className={style.text} />
                  <span className="text-[11px] font-medium text-text-primary mt-0.5">
                    {section.fromStation}
                  </span>
                  <span className="text-[10px] num text-text-secondary">Km {section.fromKm}</span>
                </div>

                <div className="flex-1 flex flex-col justify-center py-2">
                  <div
                    className={`relative h-6 ${style.segment} border flex items-center px-3`}
                  >
                    <div className="absolute inset-x-0 top-[11px] border-t border-dashed border-border-default" />
                    <div className="absolute inset-x-0 top-[15px] border-t border-dashed border-border-default" />
                    <span className={`relative text-[10px] font-medium z-10 ${style.text}`}>
                      {section.state}
                      {section.occupiedBy && (
                        <span className="text-text-secondary"> · {section.occupiedBy}</span>
                      )}
                    </span>
                  </div>
                  {section.fault && (
                    <p className="text-[10.5px] text-text-secondary mt-1 px-1">
                      fault: {section.fault}
                    </p>
                  )}
                </div>

                {last && (
                  <div className="flex flex-col items-center w-20 shrink-0">
                    <Signal size={12} strokeWidth={2} className={style.text} />
                    <span className="text-[11px] font-medium text-text-primary mt-0.5">
                    {section.toStation}
                  </span>
                    <span className="text-[10px] num text-text-secondary">Km {section.toKm}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border-default flex-wrap">
          {shownStates.map((state) => (
            <div key={state} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${sectionStateStyle[state].dot}`} />
              <span className="text-[11px] text-text-secondary">{state}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsStrip({ state }: { state: LiveState }) {
  const requests =
    state.departments.TMS.requests.length +
    state.departments.TDMS.requests.length +
    state.departments.SMMS.requests.length;
  const outcomeOrder: DecisionValue[] = [
    "approved",
    "reserved",
    "queued",
    "rerouted",
    "rejected",
  ];
  const outcomes = outcomeOrder
    .map((value) => ({
      value,
      count: state.decisions.filter((decision) => decision.decision === value).length,
    }))
    .filter((item) => item.count > 0);
  const active = state.sections.filter((section) => section.state !== "Clear");

  return (
    <div className="bg-surface border border-border-default flex items-stretch divide-x divide-border-default">
      <div className="px-4 py-3">
        <p className="text-[10.5px] uppercase tracking-wide text-text-secondary">Requests raised</p>
        <p className="text-[20px] font-semibold text-text-primary num leading-tight mt-0.5">{requests}</p>
        <p className="text-[11px] text-text-secondary">across 3 departments</p>
      </div>

      <div className="px-4 py-3">
        <p className="text-[10.5px] uppercase tracking-wide text-text-secondary">ABP outcomes</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {outcomes.length === 0 ? (
            <span className="text-[11px] text-text-secondary">no decisions yet</span>
          ) : (
            outcomes.map((item) => (
              <span
                key={item.value}
                className={`px-1.5 py-0.5 text-[10.5px] font-medium ${decisionStyle[item.value]}`}
              >
                {item.value} <span className="num">{item.count}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="px-4 py-3 min-w-0">
        <p className="text-[10.5px] uppercase tracking-wide text-text-secondary">Section state</p>
        <p className="text-[20px] font-semibold text-text-primary num leading-tight mt-0.5">
          {active.length}/{state.sections.length}
        </p>
        <p className="text-[11px] text-text-secondary truncate">
          {active.length === 0 ? "all Clear" : active.map((section) => section.id).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function RequestRow({ request, decision }: { request: AbpRequest; decision?: AbpDecision }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className={`px-1.5 py-0.5 text-[10.5px] font-medium ${typeStyle[request.type]}`}>
          {typeLabel[request.type]}
        </span>
        <span className="font-medium text-text-primary num">{request.trainId ?? request.sectionId}</span>
        <span className="text-text-secondary num">Km {request.km}</span>
        {decision && (
          <span className={`px-1.5 py-0.5 text-[10.5px] font-medium ${decisionStyle[decision.decision]}`}>
            {decision.decision}
          </span>
        )}
        <span
          className={`ml-auto px-1.5 py-0.5 text-[10.5px] font-medium ${
            request.status === "submitted" ? "bg-warning-bg text-warning" : "bg-success/8 text-success"
          }`}
        >
          {request.status}
        </span>
      </div>
      <p className="text-[12px] text-text-secondary mt-1">
        {request.description} · <span className="num">{formatClock(request.raisedAt)}</span>
        {decision && (
          <span className="text-text-primary"> · → {decision.sectionState}</span>
        )}
      </p>
    </div>
  );
}

function DecisionTable({ decisions }: { decisions: AbpDecision[] }) {
  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
        <CircleDot size={14} strokeWidth={1.75} className="text-brand" />
        <h3 className="text-[15px] font-semibold text-text-primary">ABP decisions</h3>
        <span className="ml-auto text-[11px] num text-text-secondary">
          {decisions.length} total, latest first
        </span>
      </div>
      <div className="max-h-[26rem] overflow-y-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-sunken text-text-secondary text-left">
              <th className="px-4 py-1.5 font-medium">Request</th>
              <th className="px-4 py-1.5 font-medium">Decision</th>
              <th className="px-4 py-1.5 font-medium">Section</th>
              <th className="px-4 py-1.5 font-medium">Result state</th>
              <th className="px-4 py-1.5 font-medium text-right">Window</th>
              <th className="px-4 py-1.5 font-medium text-right">Decided</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {decisions.map((decision) => (
              <tr key={decision.id} className="hover:bg-surface-sunken/50">
                <td className="px-4 py-1.5 num">{decision.requestId}</td>
                <td className="px-4 py-1.5">
                  <span className={`px-1.5 py-0.5 text-[10.5px] font-medium ${decisionStyle[decision.decision]}`}>
                    {decision.decision}
                  </span>
                </td>
                <td className="px-4 py-1.5 num">{decision.sectionId}</td>
                <td className="px-4 py-1.5 font-medium text-text-primary">{decision.sectionState}</td>
                <td className="px-4 py-1.5 text-right num">
                  {decision.grantedWindow
                    ? `${decision.grantedWindow.startMin}–${decision.grantedWindow.endMin} min`
                    : "—"}
                </td>
                <td className="px-4 py-1.5 text-right num">{formatClock(decision.decidedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LiveLoop() {
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPolled, setLastPolled] = useState<Date | null>(null);

  const decisionsById = new Map(
    (state?.decisions ?? []).map((decision) => [decision.requestId, decision]),
  );

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;

    const tick = async () => {
      controller = new AbortController();
      try {
        const next = await fetchLiveState(controller.signal);
        if (!disposed) {
          setState(next);
          setError(null);
          setLastPolled(new Date());
        }
      } catch (err) {
        if (
          !disposed &&
          !(err instanceof DOMException && err.name === "AbortError")
        ) {
          setError("Backend not reachable");
        }
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
    };
  }, []);

  const refresh = () => {
    setError(null);
    void fetchLiveState()
      .then(setState)
      .catch(() => setError("Backend not reachable"));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2.5 px-5 py-2 border-b border-border-default bg-surface shrink-0">
        <Radio size={14} strokeWidth={2} className={error ? "text-critical" : "text-success"} />
        <span className="text-[12.5px] font-medium text-text-primary">Live loop</span>
        {state && (
          <span className="text-[11px] text-text-secondary">
            feed {state.feed.source} · last seen {formatClock(state.feed.lastSeenAt)}
          </span>
        )}
        <button
          type="button"
          onClick={refresh}
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-brand hover:underline"
        >
          <RefreshCw size={12} strokeWidth={2} />
          Retry
        </button>
        <span className="text-[11px] num text-text-secondary">polled {formatClock(lastPolled?.toISOString())}</span>
      </div>

      {error && (
        <div className="px-5 pt-4 shrink-0">
          <AlertBanner
            type="warning"
            message="Member B backend is not reachable. Start it from backend/ with `npm run dev`, then retry."
          />
        </div>
      )}

      {!state && !error && (
        <div className="flex-1 flex items-center justify-center text-[13px] text-text-secondary">
          Connecting to Member B backend…
        </div>
      )}

      {state && (
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          <StatsStrip state={state} />

          <SectionSchematic sections={state.sections} />

          <InjectRequest sections={state.sections} onInjected={refresh} />

          <div className="grid grid-cols-3 gap-5">
            {departments.map((department) => {
              const Icon = department.icon;
              const requests = [...state.departments[department.key].requests].reverse();
              const total = state.departments[department.key].requests.length;
              return (
                <div key={department.key} className="bg-surface border border-border-default">
                  <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
                    <Icon size={14} strokeWidth={1.75} className="text-text-secondary" />
                    <h3 className="text-[15px] font-semibold text-text-primary">{department.label}</h3>
                    <span className="ml-auto text-[11px] num text-text-secondary">{total} raised</span>
                  </div>
                  <p className="px-4 pt-2 text-[11px] text-text-secondary">{department.sub}</p>
                  {requests.length === 0 ? (
                    <p className="px-4 py-4 text-[12.5px] text-text-secondary">
                      No requests raised yet.
                    </p>
                  ) : (
                    <div className="max-h-[24rem] overflow-y-auto">
                      <div className="divide-y divide-border-default">
                        {requests.map((request) => (
                          <RequestRow
                            key={request.id}
                            request={request}
                            decision={decisionsById.get(request.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DecisionTable decisions={[...state.decisions].reverse()} />
        </div>
      )}
    </div>
  );
}