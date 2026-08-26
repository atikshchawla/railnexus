import { cumulativeLengths, findNearestTrack, pointAtDistance } from "@/lib/services/digital-twin/geometry";
import { isDiverted } from "@/lib/services/digital-twin/simulation.service";
import type { DisasterEvent, DisasterKind, RailwayNetwork, Selection, Station, Track, Vec2 } from "@/lib/services/digital-twin/types";
import { drawSignalNode } from "./SignalNode";
import { drawTrainMarker } from "./TrainMarker";

export const EVENT_COLORS: Record<DisasterKind, string> = {
  BROKEN_TRACK: "#dc2626",
  FLOODING: "#0284c7",
  SIGNAL_FAILURE: "#d97706",
  OHE_FAULT: "#ea580c",
  MIXED_SCHEDULE: "#7c3aed",
};

export const TRACK_COLORS: Record<Track["kind"], string> = {
  up: "#dc2626",
  down: "#2563eb",
  loop: "#64748b",
  siding: "#94a3b8",
};

export function lineColor(track: Track): string {
  return track.color ?? TRACK_COLORS[track.kind];
}

const CANVAS_BG = "#1a1d2e";

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  worldW: number,
  worldH: number,
  wx0: number,
  wy0: number
): void {
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.translate(Math.floor(wx0 / 100) * 100, Math.floor(wy0 / 100) * 100);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1 / ctx.getTransform().a;
  ctx.beginPath();
  for (let x = 0; x <= worldW + 200; x += 100) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, worldH + 200);
  }
  for (let y = 0; y <= worldH + 200; y += 100) {
    ctx.moveTo(0, y);
    ctx.lineTo(worldW + 200, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawTrack(
  ctx: CanvasRenderingContext2D,
  track: Track,
  selected: boolean
): void {
  const color = lineColor(track);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // dark casing (metro-map look)
  ctx.strokeStyle = "#2a2d3e";
  ctx.lineWidth = selected ? 16 : 13;
  strokePolyline(ctx, track.points);

  // coloured line
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 12 : 9;
  if (selected) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
  }
  strokePolyline(ctx, track.points);
  ctx.shadowBlur = 0;

  // subtle rail hint down the centre
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([10, 14]);
  strokePolyline(ctx, track.points);
  ctx.setLineDash([]);
}

function strokePolyline(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function drawBolt(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx + 3, cy - 9);
  ctx.lineTo(cx - 4, cy + 1);
  ctx.lineTo(cx, cy + 1);
  ctx.lineTo(cx - 3, cy + 9);
  ctx.lineTo(cx + 4, cy - 1);
  ctx.lineTo(cx, cy - 1);
  ctx.closePath();
  ctx.fillStyle = "#ea580c";
  ctx.fill();
  ctx.strokeStyle = "#1a1d2e";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Ghost preview while the user is placing a location-based disaster. */
export function drawEventGhost(
  ctx: CanvasRenderingContext2D,
  kind: DisasterKind,
  position: Vec2
): void {
  ctx.globalAlpha = 0.65;
  if (kind === "BROKEN_TRACK") {
    ctx.beginPath();
    ctx.arc(position.x, position.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = EVENT_COLORS.BROKEN_TRACK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = EVENT_COLORS.BROKEN_TRACK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(position.x - 6, position.y - 6);
    ctx.lineTo(position.x + 6, position.y + 6);
    ctx.moveTo(position.x + 6, position.y - 6);
    ctx.lineTo(position.x - 6, position.y + 6);
    ctx.stroke();
  } else if (kind === "FLOODING") {
    ctx.beginPath();
    ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(14,165,233,0.4)";
    ctx.fill();
    ctx.strokeStyle = EVENT_COLORS.FLOODING;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (kind === "OHE_FAULT") {
    drawBolt(ctx, position.x, position.y - 18);
    ctx.beginPath();
    ctx.arc(position.x, position.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = EVENT_COLORS.OHE_FAULT;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Full highlight when the user hovers an active event marker. */
export function drawEventHighlight(
  ctx: CanvasRenderingContext2D,
  track: Track,
  event: DisasterEvent,
  position: Vec2,
  clockMs: number
): void {
  const color = EVENT_COLORS[event.kind];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#2a2d3e";
  ctx.lineWidth = 16;
  strokePolyline(ctx, track.points);
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  strokePolyline(ctx, track.points);
  ctx.shadowBlur = 0;

  const pulse = 14 + Math.sin(clockMs / 160) * 3;
  ctx.beginPath();
  ctx.arc(position.x, position.y, pulse, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = "bold 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(26,29,46,0.95)";
  const label = `${event.label} · ${event.affectedTrains ?? 0} train${event.affectedTrains === 1 ? "" : "s"} affected`;
  ctx.strokeText(label, position.x, position.y - 30);
  ctx.fillStyle = color;
  ctx.fillText(label, position.x, position.y - 30);
}

/** A station touching 2+ tracks is an interchange. */
export function isInterchange(network: RailwayNetwork, station: Station): boolean {
  let touching = 0;
  for (const track of Object.values(network.tracks)) {
    const nearest = findNearestTrack({ [track.id]: track }, station.position, 45);
    if (nearest) touching += 1;
    if (touching >= 2) return true;
  }
  return false;
}

export function drawStation(
  ctx: CanvasRenderingContext2D,
  network: RailwayNetwork,
  station: Station,
  selected: boolean
): void {
  const interchange = isInterchange(network, station);
  const { x, y } = station.position;

  let ringColor = "#334155";
  for (const track of Object.values(network.tracks)) {
    const nearest = findNearestTrack({ [track.id]: track }, station.position, 45);
    if (nearest) {
      ringColor = lineColor(track);
      break;
    }
  }

  const r = interchange ? 9.5 : 6.5;

  if (interchange) {
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#2a2d3e";
  ctx.fill();
  ctx.strokeStyle = selected ? "#0284c7" : ringColor;
  ctx.lineWidth = selected ? 3.5 : 2.5;
  ctx.stroke();

  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, r + 7, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.font = interchange
    ? "bold 11.5px ui-sans-serif, system-ui, sans-serif"
    : "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(26,29,46,0.9)";
  ctx.strokeText(station.name, x, y + r + 15);
  ctx.fillStyle = "#e8e8ed";
  ctx.fillText(station.name, x, y + r + 15);
}

const POLE_LENGTH = 12;

export function drawLevelCrossing(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  selected: boolean
): void {
  const { x, y } = position;

  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#2a2d3e";
  ctx.fill();
  ctx.strokeStyle = selected ? "#0284c7" : "#334155";
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  ctx.strokeStyle = selected ? "#0284c7" : "#b91c1c";
  ctx.lineWidth = 2.25;
  ctx.beginPath();
  ctx.moveTo(x - 4.5, y - 4.5);
  ctx.lineTo(x + 4.5, y + 4.5);
  ctx.moveTo(x + 4.5, y - 4.5);
  ctx.lineTo(x - 4.5, y + 4.5);
  ctx.stroke();
}

export function drawPole(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  angle: number,
  zoom: number,
  selected: boolean
): void {
  if (zoom < 0.55 && !selected) return;

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);

  ctx.strokeStyle = selected ? "#0284c7" : "#94a3b8";
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -POLE_LENGTH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -POLE_LENGTH);
  ctx.lineTo(4, -POLE_LENGTH);
  ctx.stroke();

  ctx.restore();
}

/** Draw every entity for one frame, including disaster event overlays. */
export function drawNetwork(
  ctx: CanvasRenderingContext2D,
  network: RailwayNetwork,
  selection: Selection | null,
  zoom: number,
  events: DisasterEvent[] = [],
  clockMs = 0
): void {
  for (const track of Object.values(network.tracks)) {
    drawTrack(ctx, track, selection?.kind === "track" && selection.id === track.id);
  }

  // per-train route plans: train colour = planned path, grey = abandoned by diversion
  for (const train of Object.values(network.trains)) {
    const isSelected = selection?.kind === "train" && selection.id === train.id;
    const diverted = isDiverted(train);
    const alpha = isSelected ? 0.95 : 0.4;

    if (diverted) {
      ctx.globalAlpha = alpha;
      ctx.setLineDash([3, 9]);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 3;
      for (const trackId of train.originalRoute) {
        if (train.route.includes(trackId)) continue;
        const abandoned = network.tracks[trackId];
        if (!abandoned) continue;
        strokePolyline(ctx, abandoned.points);
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = alpha;
    ctx.setLineDash([11, 8]);
    ctx.strokeStyle = train.color;
    ctx.lineWidth = isSelected ? 4.5 : 3;
    for (const trackId of train.route) {
      const routeTrack = network.tracks[trackId];
      if (!routeTrack) continue;
      strokePolyline(ctx, routeTrack.points);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // disaster overlays on lines
  for (const event of events) {
    const track = event.trackId ? network.tracks[event.trackId] : undefined;
    if (!track) continue;

    if (event.kind === "FLOODING") {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(14,165,233,0.4)";
      ctx.lineWidth = 18;
      strokePolyline(ctx, track.points);
    }

    if (event.kind === "BROKEN_TRACK" && event.positionM !== undefined) {
      const cum = cumulativeLengths(track.points);
      const { position } = pointAtDistance(track.points, cum, event.positionM);
      const pulse = 11 + Math.sin(clockMs / 180) * 2.5;
      ctx.beginPath();
      ctx.arc(position.x, position.y, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(220,38,38,0.55)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(position.x - 7, position.y - 7);
      ctx.lineTo(position.x + 7, position.y + 7);
      ctx.moveTo(position.x + 7, position.y - 7);
      ctx.lineTo(position.x - 7, position.y + 7);
      ctx.stroke();
    }

    if (event.kind === "OHE_FAULT" && event.positionM !== undefined) {
      const cum = cumulativeLengths(track.points);
      const { position } = pointAtDistance(track.points, cum, event.positionM);
      drawBolt(ctx, position.x, position.y - 18);
    }
  }

  for (const pole of Object.values(network.poles)) {
    const track = network.tracks[pole.trackId];
    if (!track) continue;
    const cum = cumulativeLengths(track.points);
    const { position, angle } = pointAtDistance(track.points, cum, pole.positionM);
    drawPole(ctx, position, angle, zoom, selection?.kind === "pole" && selection.id === pole.id);
  }

  for (const crossing of Object.values(network.crossings)) {
    const track = network.tracks[crossing.trackId];
    if (!track) continue;
    const cum = cumulativeLengths(track.points);
    const { position } = pointAtDistance(track.points, cum, crossing.positionM);
    drawLevelCrossing(ctx, position, selection?.kind === "crossing" && selection.id === crossing.id);
  }

  for (const station of Object.values(network.stations)) {
    const isSelectedDest =
      selection?.kind === "train" &&
      network.trains[selection.id]?.destinationStationId === station.id;
    drawStation(ctx, network, station, selection?.kind === "station" && selection.id === station.id);
    if (isSelectedDest) {
      const pulse = 15 + Math.sin(clockMs / 220) * 3;
      ctx.beginPath();
      ctx.arc(station.position.x, station.position.y, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(26,29,46,0.9)";
      ctx.strokeText("DESTINATION", station.position.x, station.position.y - 24);
      ctx.fillStyle = "#0284c7";
      ctx.fillText("DESTINATION", station.position.x, station.position.y - 24);
    }
  }

  const failedSignals = new Set<string>();
  for (const event of events) {
    if (event.kind === "SIGNAL_FAILURE" && event.signalId) failedSignals.add(event.signalId);
  }

  for (const signal of Object.values(network.signals)) {
    const track = network.tracks[signal.trackId];
    if (!track) continue;
    const cum = cumulativeLengths(track.points);
    const { position, angle } = pointAtDistance(track.points, cum, signal.positionM);
    drawSignalNode(
      ctx,
      position,
      angle,
      signal.aspect,
      selection?.kind === "signal" && selection.id === signal.id,
      failedSignals.has(signal.id)
    );
  }

  for (const train of Object.values(network.trains)) {
    const track = network.tracks[train.trackId];
    if (!track) continue;
    const cum = cumulativeLengths(track.points);
    const { position, angle } = pointAtDistance(track.points, cum, train.positionM);
    drawTrainMarker(
      ctx,
      position,
      angle,
      train,
      selection?.kind === "train" && selection.id === train.id,
      isDiverted(train)
    );
  }
}
