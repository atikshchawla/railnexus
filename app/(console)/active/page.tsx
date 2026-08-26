"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Panel, Btn, Chip, Meter, Lamp } from "@/components/ui-kit";
import { useConsole } from "@/lib/console-store";

export default function ActiveBlock() {
  const { state, dispatch } = useConsole();

  useEffect(() => {
    if (!state.blockActive) return;
    const t = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(t);
  }, [state.blockActive, dispatch]);

  const total = 150 * 60;
  const pct = (state.remaining / total) * 100;
  const hh = Math.floor(state.remaining / 3600);
  const mm = Math.floor((state.remaining % 3600) / 60);
  const ss = state.remaining % 60;

  if (!state.blockActive) {
    return (
      <Panel title="Active Block" signal="neutral" className="max-w-xl">
        <p className="text-sm text-muted-foreground">
          No block is currently active. Complete the authorization step to commence.
        </p>
        <div className="mt-4">
          <Link href="/authorize">
            <Btn variant="primary">Go to Authorization</Btn>
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Panel
        title="Block Execution"
        signal="red"
        right={
          <span className="num flex items-center gap-2 text-[10px] text-signal-red">
            <Lamp tone="red" /> BLOCK ACTIVE
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="hairline bg-panel-raised p-3">
            <p className="num text-[10px] text-muted-foreground">SECTION</p>
            <p className="num text-xs">Rajiv Chowk – INA (UP)</p>
            <p className="num text-xs text-muted-foreground">KM 214/6 · Yellow Line</p>
          </div>
          <div className="hairline bg-panel-raised p-3">
            <p className="num text-[10px] text-muted-foreground">SIGNALS</p>
            <p className="num text-xs text-signal-red">FETTERED</p>
            <p className="num text-xs text-muted-foreground">S-214U, S-215U</p>
          </div>
          <div className="hairline bg-panel-raised p-3">
            <p className="num text-[10px] text-muted-foreground">KAVACH ZONE</p>
            <p className="num flex items-center gap-2 text-xs text-signal-green">
              <Lamp tone="green" /> ACTIVE
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="num mb-1 flex justify-between text-[11px]">
            <span className="text-muted-foreground">TIME REMAINING</span>
            <span className="text-signal-amber">
              {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:
              {String(ss).padStart(2, "0")}
            </span>
          </div>
          <Meter value={pct} tone={pct < 20 ? "red" : "amber"} />
        </div>

        <div className="mt-4">
          <p className="num mb-2 text-[10px] tracking-[0.14em] text-muted-foreground">
            ACTIVE WORK TREE
          </p>
          <ul className="num space-y-1.5 border-l border-border pl-4 text-[11px]">
            <li className="flex items-center gap-2">
              <Chip tone="green">ENGG</Chip> Weld renewal KM 214/6 — in progress
            </li>
            <li className="flex items-center gap-2 pl-4">
              <Chip tone="amber">TRD</Chip> OHE dropper replacement KM 214/8 — shadow
            </li>
            <li className="flex items-center gap-2 pl-4">
              <Chip tone="green">S&amp;T</Chip> Axle counter reset KM 215/1 — completed
            </li>
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Btn variant="danger" onClick={() => dispatch({ type: "endBlock" })}>
            Emergency Cancel
          </Btn>
          <Btn variant="primary" onClick={() => dispatch({ type: "extend" })}>
            Request Extension
          </Btn>
          <Btn variant="go" onClick={() => dispatch({ type: "endBlock" })}>
            Complete
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
