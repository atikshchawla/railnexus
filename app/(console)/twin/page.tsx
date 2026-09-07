"use client";

import Link from "next/link";
import { MetroMap } from "@/components/MetroMap";
import { Timeline } from "@/components/Timeline";
import { Panel, Btn, Lamp } from "@/components/ui-kit";
import { checkConflicts } from "@/lib/conflict";
import { fmtTime } from "@/lib/mock-data";
import { useConsole } from "@/lib/console-store";

export default function Twin() {
  const { state, dispatch } = useConsole();
  const { start, end } = state.block;
  const res = checkConflicts(start, end);
  const conflict = res.status === "conflict";

  return (
    <div className="space-y-4">
      <Panel
        title="Digital Twin — Proposed Block Corridor"
        signal={conflict ? "red" : "green"}
        right={
          <span className="num flex items-center gap-2 text-[10px]">
            <Lamp tone={conflict ? "red" : "green"} />
            {conflict ? "CONFLICT" : "CLEAR"}
          </span>
        }
      >
        <MetroMap
          height={520}
          selectedLine={state.block.lineId}
          corridor={state.block}
          conflict={conflict}
          showFreight
          onSelectLine={(id) => dispatch({ type: "selectLine", lineId: id })}
        />
      </Panel>

      <Panel title="Temporal Adjustment · 12:00 – 18:00" signal={conflict ? "red" : "amber"}>
        <Timeline
          start={start}
          end={end}
          conflict={conflict}
          onChange={(s, e) => dispatch({ type: "setWindow", start: s, end: e })}
        />

        <div
          className={`mt-4 border px-4 py-3 ${
            conflict ? "border-signal-red bg-signal-red/10" : "border-signal-green bg-signal-green/10"
          }`}
        >
          <p className={`num text-xs ${conflict ? "text-signal-red" : "text-signal-green"}`}>
            {res.message}
          </p>
          {conflict && res.suggestion && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="num text-[11px] text-muted-foreground">
                SUGGESTED: {fmtTime(res.suggestion.start)}–{fmtTime(res.suggestion.end)}
              </span>
              <Btn onClick={() => dispatch({ type: "setWindow", start: 810, end: 960 })}>Revert</Btn>
              <Btn
                variant="primary"
                onClick={() =>
                  dispatch({
                    type: "setWindow",
                    start: res.suggestion!.start,
                    end: res.suggestion!.end,
                  })
                }
              >
                Apply Suggestion
              </Btn>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Link href="/approvals">
            <Btn variant="go" disabled={conflict}>
              Submit for Approval
            </Btn>
          </Link>
          <Link href="/">
            <Btn>Back to Dashboard</Btn>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
