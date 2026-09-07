"use client";

import Link from "next/link";
import { Panel, Btn, Chip, Meter } from "@/components/ui-kit";
import { useConsole } from "@/lib/console-store";

export default function Approvals() {
  const { state, dispatch } = useConsole();
  const pending = state.approvals.filter((a) => a.status === "pending");

  return (
    <div className="space-y-4">
      <Panel
        title={`Pending Approvals (${pending.length})`}
        signal={pending.length ? "amber" : "green"}
        right={
          state.role !== "Controller" ? (
            <span className="num text-[10px] text-signal-amber">
              SWITCH ROLE → CONTROLLER TO DECIDE
            </span>
          ) : null
        }
      >
        <div className="space-y-3">
          {state.approvals.map((a) => (
            <div key={a.id} className="hairline bg-panel-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="num text-sm text-signal-amber">{a.id}</span>
                  <Chip
                    tone={
                      a.status === "approved" ? "green" : a.status === "rejected" ? "red" : "amber"
                    }
                  >
                    {a.status.toUpperCase()}
                  </Chip>
                </div>
                <span className="num text-[11px] text-muted-foreground">{a.requester}</span>
              </div>

              <p className="num mt-2 text-xs">{a.section}</p>
              <p className="num text-xs text-signal-amber">{a.window}</p>

              <div className="mt-3 max-w-xs">
                <div className="num mb-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>AI CONFIDENCE</span>
                  <span>{a.confidence}%</span>
                </div>
                <Meter value={a.confidence} tone={a.confidence >= 80 ? "green" : "amber"} />
              </div>

              <div className="mt-3">
                <p className="num text-[10px] tracking-[0.14em] text-muted-foreground">
                  BUNDLED SHADOW WORK
                </p>
                {a.shadowWork.length ? (
                  <ul className="num mt-1 space-y-0.5 text-[11px]">
                    {a.shadowWork.map((w) => (
                      <li key={w}>· {w}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="num mt-1 text-[11px] text-muted-foreground">None</p>
                )}
              </div>

              <p className="num mt-3 text-[11px] text-muted-foreground">IMPACT: {a.impact}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/twin">
                  <Btn>Simulate</Btn>
                </Link>
                <Link href="/authorize">
                  <Btn
                    variant="go"
                    disabled={state.role !== "Controller" || a.status !== "pending"}
                    onClick={() => dispatch({ type: "decide", id: a.id, status: "approved" })}
                  >
                    Approve
                  </Btn>
                </Link>
                <Btn
                  variant="danger"
                  disabled={state.role !== "Controller" || a.status !== "pending"}
                  onClick={() => dispatch({ type: "decide", id: a.id, status: "rejected" })}
                >
                  Reject
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
