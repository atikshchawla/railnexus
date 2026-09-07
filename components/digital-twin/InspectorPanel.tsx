"use client";

import { useTwinStore } from "@/lib/services/digital-twin/state.service";
import { isDiverted } from "@/lib/services/digital-twin/simulation.service";

export function InspectorPanel() {
  const network = useTwinStore((s) => s.network);
  const selection = useTwinStore((s) => s.selection);
  const toggleTrainHalt = useTwinStore((s) => s.toggleTrainHalt);
  const cycleSignalAspect = useTwinStore((s) => s.cycleSignalAspect);

  let body: React.ReactNode;

  if (!selection) {
    body = (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Nothing selected. Pick a tool to inspect or place elements.
        <br />
        <br />
        Tip: double-click a signal to cycle its aspect, or drag a train along its line.
      </p>
    );
  } else if (selection.kind === "train") {
    const train = network.trains[selection.id];
    const track = train && network.tracks[train.trackId];
    body = train ? (
      <div className="space-y-1.5 text-[13px]">
        <Row label="Name" value={train.name} />
        <Row label="Type" value={train.kind} />
        <Row label="Status" value={train.status} />
        {train.haltReason && <Row label="Action" value={train.haltReason} />}
        <Row label="Line" value={track ? track.name : "—"} />
        <PositionReadout trainId={train.id} />
        <Row label="Speed" value={`${train.speedKmph} km/h`} />
        <div className="mt-2 border-t border-border pt-2">
          <Row
            label="Destination"
            value={network.stations[train.destinationStationId]?.name ?? "—"}
          />
          {isDiverted(train) && (
            <div className="mt-1.5">
              <span className="num text-[11px] uppercase tracking-wide text-muted-foreground">
                Original plan
              </span>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-through">
                {train.originalRoute
                  .map((tid) => network.tracks[tid]?.name ?? "?")
                  .join(" → ")}
              </p>
            </div>
          )}
          <div className="mt-1.5">
            <span className="num text-[11px] uppercase tracking-wide text-muted-foreground">
              {isDiverted(train) ? "Diverted route" : "Route"}
            </span>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground">
              {train.route.length > 0
                ? train.route
                    .map((tid) => network.tracks[tid]?.name ?? "?")
                    .join(" → ")
                : "planning…"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Next:{" "}
              {train.route[1]
                ? `switch to ${network.tracks[train.route[1]]?.name ?? "?"}`
                : train.route[0] === track?.id
                  ? "arrive at destination"
                  : "continue on line"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1.5">
          <button
            onClick={() => toggleTrainHalt(train.id)}
            className={`border px-3 py-1 text-xs font-semibold transition-colors ${
              train.manualHold
                ? "border-signal-green text-signal-green hover:bg-signal-green/10"
                : "border-signal-red text-signal-red hover:bg-signal-red/10"
            }`}
          >
            {train.manualHold ? "Release" : "Hold"}
          </button>
          <span className="text-[11px] text-muted-foreground">or drag it along its line</span>
        </div>
      </div>
    ) : (
      <Deleted />
    );
  } else if (selection.kind === "signal") {
    const signal = network.signals[selection.id];
    body = signal ? (
      <div className="space-y-1.5 text-[13px]">
        <Row label="Name" value={signal.name} />
        <Row label="Aspect" value={signal.aspect} />
        <Row label="At" value={`${Math.round(signal.positionM)} m on line`} />
        <button
          onClick={() => cycleSignalAspect(signal.id)}
          className="mt-1 border border-signal-amber px-3 py-1 text-xs font-semibold text-signal-amber transition-colors hover:bg-signal-amber/10"
        >
          Cycle Aspect
        </button>
      </div>
    ) : (
      <Deleted />
    );
  } else if (selection.kind === "station") {
    const station = network.stations[selection.id];
    body = station ? (
      <div className="space-y-1.5 text-[13px]">
        <Row label="Name" value={station.name} />
        <Row label="Platforms" value={String(station.platforms)} />
        <p className="pt-1 text-[11px] text-muted-foreground">Drag to reposition.</p>
      </div>
    ) : (
      <Deleted />
    );
  } else if (selection.kind === "pole") {
    const pole = network.poles[selection.id];
    body = pole ? (
      <div className="space-y-1.5 text-[13px]">
        <Row label="Name" value={pole.name} />
        <Row label="Line" value={network.tracks[pole.trackId]?.name ?? "—"} />
        <Row label="At" value={`${Math.round(pole.positionM)} m`} />
      </div>
    ) : (
      <Deleted />
    );
  } else if (selection.kind === "crossing") {
    const crossing = network.crossings[selection.id];
    body = crossing ? (
      <div className="space-y-1.5 text-[13px]">
        <Row label="Name" value={crossing.name} />
        <Row label="Line" value={network.tracks[crossing.trackId]?.name ?? "—"} />
        <Row label="At" value={`${Math.round(crossing.positionM)} m`} />
      </div>
    ) : (
      <Deleted />
    );
  } else {
    const track = network.tracks[selection.id.split("::")[0]];
    body = track ? (
      <div className="space-y-1.5 text-[13px]">
        <Row label="Name" value={track.name} />
        <Row label="Kind" value={track.kind} />
        <Row label="Length" value={`${Math.round(track.lengthM)} m`} />
        <p className="pt-1 text-[11px] text-muted-foreground">Drag vertices to reshape.</p>
      </div>
    ) : null;
  }

  return (
    <div className="panel w-64 p-3">
      <h2 className="num mb-2 border-b border-border pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        Inspector
      </h2>
      {body}
    </div>
  );
}

function PositionReadout({ trainId }: { trainId: string }) {
  const positionM = useTwinStore((s) => Math.round(s.network.trains[trainId]?.positionM ?? 0));
  return <Row label="Position" value={`${(positionM / 1000).toFixed(2)} km`} />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-medium text-foreground">{value}</span>
    </div>
  );
}

function Deleted() {
  return <p className="text-[13px] font-medium text-signal-red">Entity no longer exists.</p>;
}
