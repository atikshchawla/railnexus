"use client";

import Link from "next/link";
import { ConsoleProvider } from "@/lib/console-store";
import { Shell } from "@/components/Shell";
import { MetroMap } from "@/components/MetroMap";
import { Panel, Chip, Btn, Meter, Lamp } from "@/components/ui-kit";
import { DEFECTS, TRAINS, LINE_LABELS } from "@/lib/mock-data";
import { LINES } from "@/lib/metro";
import { useConsole } from "@/lib/console-store";

function Dashboard() {
  const { state, dispatch } = useConsole();
  const sel = state.selectedLine;
  const defects = DEFECTS.filter((d) => !sel || d.lineId === sel);
  const drawer = DEFECTS.find((d) => d.id === state.drawerDefectId) ?? null;

  const counts = LINES.map((l) => ({
    id: l.id,
    n: TRAINS.filter((t) => t.lineId === l.id).length,
  })).filter((c) => c.n > 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex items-center gap-3 border border-signal-red bg-signal-red/10 px-4 py-2.5">
          <Lamp tone="red" />
          <p className="text-sm">
            <span className="num">{defects.filter((d) => d.severity === "IMR").length}</span> new
            defects detected in your section
            {sel ? ` · ${LINE_LABELS[sel]} Line` : ""}
          </p>
        </div>

        <Panel
          title="Delhi Metro — Live Network Twin"
          signal={sel ? "amber" : "green"}
          right={
            <div className="flex items-center gap-2">
              {sel && (
                <button
                  onClick={() => dispatch({ type: "selectLine", lineId: null })}
                  className="num text-[10px] text-signal-amber"
                >
                  CLEAR FILTER
                </button>
              )}
              <span className="num text-[10px] text-muted-foreground">
                {TRAINS.filter((t) => !sel || t.lineId === sel).length} SERVICES RUNNING
              </span>
            </div>
          }
        >
          <MetroMap
            height={480}
            selectedLine={sel}
            onSelectLine={(id) => dispatch({ type: "selectLine", lineId: id })}
            onSelectTrain={(trainId, lineId) => dispatch({ type: "selectTrain", trainId, lineId })}
            corridor={state.block}
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {counts.map((c) => {
              const line = LINES.find((l) => l.id === c.id)!;
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    dispatch({ type: "selectLine", lineId: sel === c.id ? null : c.id })
                  }
                  className={`flex items-center gap-2 border px-2 py-1 ${
                    sel === c.id ? "border-signal-amber" : "border-border"
                  }`}
                >
                  <span className="h-2 w-4" style={{ background: line.color }} />
                  <span className="num text-[10px] text-muted-foreground">
                    {LINE_LABELS[c.id]} · {c.n}
                  </span>
                </button>
              );
            })}
          </div>
          {state.selectedTrain && (
            <p className="num mt-2 text-[11px] text-signal-amber">
              TRACKING SERVICE {state.selectedTrain}
            </p>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-1">
          <Panel title="Pending Blocks" signal="amber">
            <p className="num text-3xl">5</p>
          </Panel>
          <Panel title="Active Blocks" signal="red">
            <p className="num text-3xl">2</p>
          </Panel>
          <Panel title="Today's Schedule" signal="green">
            <p className="num mb-2 text-3xl">45%</p>
            <Meter value={45} tone="green" />
          </Panel>
        </div>

        <Panel title="Recent Defects" signal="red">
          <ul className="divide-y divide-border">
            {defects.map((d) => (
              <li key={d.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Chip tone={d.severity === "IMR" ? "red" : "amber"}>{d.severity}</Chip>
                    <span className="num text-[11px]">{d.km}</span>
                  </div>
                  <span className="num text-[10px] text-muted-foreground">
                    T−{Math.floor(d.minutesLeft / 60)}h{String(d.minutesLeft % 60).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{d.type}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="num text-[10px] text-muted-foreground">
                    {LINE_LABELS[d.lineId]} · {d.detectedAt}
                  </span>
                  {d.severity === "IMR" && (
                    <button
                      onClick={() => dispatch({ type: "openDrawer", defectId: d.id })}
                      className="num text-[10px] text-signal-amber"
                    >
                      AI PROPOSAL →
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {drawer && (
        <aside className="fixed right-0 top-0 z-50 h-screen w-[380px] overflow-y-auto border-l border-border bg-panel">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm">AI Block Proposal</h2>
            <button
              onClick={() => dispatch({ type: "closeDrawer" })}
              className="num text-xs text-muted-foreground"
            >
              ESC ✕
            </button>
          </header>
          <div className="space-y-4 p-4">
            <p className="num text-[11px] text-signal-red">
              {drawer.id} · {drawer.km} · {drawer.section}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Recommend a corridor block of <span className="num text-foreground">13:30–16:00</span>{" "}
              on {drawer.section} to rectify {drawer.type.toLowerCase()}. Traffic density is lowest
              in this window and a shadow TRD job can be bundled at KM 214/8.
            </p>

            <div>
              <div className="num mb-1 flex justify-between text-[10px] text-muted-foreground">
                <span>CONFIDENCE</span>
                <span className="text-signal-green">82%</span>
              </div>
              <Meter value={82} tone="green" />
            </div>

            <Panel title="Shadow Block Availability" signal="green" className="text-xs">
              <p className="num text-[11px]">TRD · OHE dropper · AVAILABLE</p>
              <p className="num text-[11px]">S&T · axle counter · AVAILABLE</p>
            </Panel>

            <Panel title="Trains Affected" signal="amber" className="text-xs">
              <p className="num text-[11px]">4 rescheduled · 0 cancelled</p>
              <p className="num text-[11px]">Max detention 12 min</p>
            </Panel>

            <div className="flex flex-wrap gap-2">
              <Link href="/twin" onClick={() => dispatch({ type: "closeDrawer" })}>
                <Btn variant="primary">View in Twin</Btn>
              </Link>
              <Link href="/twin" onClick={() => dispatch({ type: "closeDrawer" })}>
                <Btn>Adjust Timing</Btn>
              </Link>
              <Link href="/approvals" onClick={() => dispatch({ type: "closeDrawer" })}>
                <Btn variant="go">Request Block</Btn>
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ConsoleProvider>
      <Shell>
        <Dashboard />
      </Shell>
    </ConsoleProvider>
  );
}
