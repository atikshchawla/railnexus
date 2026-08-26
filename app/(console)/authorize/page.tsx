"use client";

import Link from "next/link";
import { Panel, Btn, Lamp } from "@/components/ui-kit";
import { useConsole } from "@/lib/console-store";

export default function Authorize() {
  const { state, dispatch } = useConsole();
  const both = state.ackSM && state.ackSSE;

  return (
    <div className="max-w-2xl space-y-4">
      <Panel title="Private Number Exchange" signal={both ? "green" : "amber"}>
        <p className="num text-[11px] text-muted-foreground">
          REQUEST BR-4471 · APPROVED BY CONTROLLER · 13:30–16:00
        </p>

        <div className="mt-4 border border-border bg-panel-raised px-6 py-8 text-center">
          <p className="num text-[10px] tracking-[0.2em] text-muted-foreground">PRIVATE NUMBER</p>
          <p
            className="num mt-2 select-none text-4xl tracking-[0.3em] text-signal-amber"
            onPointerDown={() => dispatch({ type: "reveal", value: true })}
            onPointerUp={() => dispatch({ type: "reveal", value: false })}
            onPointerLeave={() => dispatch({ type: "reveal", value: false })}
          >
            {state.numberRevealed ? "48 219" : "•• •••"}
          </p>
          <p className="num mt-3 text-[10px] text-muted-foreground">HOLD TO REVEAL</p>
        </div>

        <div className="mt-4 space-y-2">
          {(["SM", "SSE"] as const).map((who) => {
            const checked = who === "SM" ? state.ackSM : state.ackSSE;
            return (
              <label
                key={who}
                className="flex cursor-pointer items-center gap-3 border border-border bg-panel-raised px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => dispatch({ type: "ack", who, value: e.target.checked })}
                  className="h-4 w-4 accent-[var(--signal-green)]"
                />
                <span className="num text-xs">
                  {who === "SM" ? "STATION MASTER" : "SSE / P.WAY"} acknowledges private number
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3 border border-border px-4 py-3">
          <Lamp tone={both ? "green" : "amber"} />
          <p className="num text-[11px]">
            {both
              ? "BOTH ACKNOWLEDGMENTS RECEIVED — BLOCK MAY BE TAKEN"
              : "WAITING FOR ACKNOWLEDGMENTS…"}
          </p>
        </div>

        <div className="mt-4">
          <Link href="/active">
            <Btn variant="go" disabled={!both} onClick={() => dispatch({ type: "startBlock" })}>
              Commence Block
            </Btn>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
