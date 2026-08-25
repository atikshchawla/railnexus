"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cumulativeLengths,
  findNearestTrack,
  pointAtDistance,
  distance,
} from "@/lib/services/digital-twin/geometry";
import { useTwinStore } from "@/lib/services/digital-twin/state.service";
import type { RailwayNetwork, Selection, Vec2 } from "@/lib/services/digital-twin/types";
import { drawBackground, drawNetwork, drawLevelCrossing, drawStation, drawPole } from "./renderers";
import { drawSignalNode } from "./SignalNode";
import { TRAIN_COLORS } from "./TrainMarker";

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

type Drag =
  | { mode: "pan"; startScreen: Vec2; startCam: Vec2 }
  | { mode: "station"; stationId: string }
  | { mode: "train"; trainId: string }
  | { mode: "vertex"; trackId: string; index: number }
  | null;

const SNAP_RADIUS = 45;
const HIT_RADIUS = 10;

const PLACE_LABELS: Record<string, string> = {
  signal: "signal",
  pole: "OHE pole",
  crossing: "level crossing",
  train: "train",
};

export function MapRenderer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.6 });
  const didInitRef = useRef(false);
  const dragRef = useRef<Drag>(null);
  const draftPointsRef = useRef<Vec2[] | null>(null);
  const cursorWorldRef = useRef<Vec2 | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const notice = useTwinStore((s) => s.notice);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: (clientX - rect.left - cam.x) / cam.zoom,
      y: (clientY - rect.top - cam.y) / cam.zoom,
    };
  }, []);

  /* ---------------- hit testing ---------------- */

  const hitTest = useCallback((network: RailwayNetwork, p: Vec2): Selection | null => {
    for (const train of Object.values(network.trains)) {
      const track = network.tracks[train.trackId];
      if (!track) continue;
      const cum = cumulativeLengths(track.points);
      const { position } = pointAtDistance(track.points, cum, train.positionM);
      if (distance(p, position) <= 22) return { kind: "train", id: train.id };
    }
    for (const signal of Object.values(network.signals)) {
      const track = network.tracks[signal.trackId];
      if (!track) continue;
      const cum = cumulativeLengths(track.points);
      const { position } = pointAtDistance(track.points, cum, signal.positionM);
      if (distance(p, { x: position.x, y: position.y - 13 }) <= 14) {
        return { kind: "signal", id: signal.id };
      }
    }
    for (const crossing of Object.values(network.crossings)) {
      const track = network.tracks[crossing.trackId];
      if (!track) continue;
      const cum = cumulativeLengths(track.points);
      const { position } = pointAtDistance(track.points, cum, crossing.positionM);
      if (distance(p, position) <= 12) {
        return { kind: "crossing", id: crossing.id };
      }
    }
    for (const station of Object.values(network.stations)) {
      if (
        Math.abs(p.x - station.position.x) <= 52 &&
        Math.abs(p.y - station.position.y) <= 20
      ) {
        return { kind: "station", id: station.id };
      }
    }
    for (const pole of Object.values(network.poles)) {
      const track = network.tracks[pole.trackId];
      if (!track) continue;
      const cum = cumulativeLengths(track.points);
      const { position } = pointAtDistance(track.points, cum, pole.positionM);
      if (distance(p, position) <= HIT_RADIUS) return { kind: "pole", id: pole.id };
    }
    for (const track of Object.values(network.tracks)) {
      for (let i = 0; i < track.points.length; i++) {
        if (distance(p, track.points[i]) <= HIT_RADIUS) {
          return { kind: "track", id: `${track.id}::vertex::${i}` };
        }
      }
    }
    const nearest = findNearestTrack(network.tracks, p, HIT_RADIUS);
    if (nearest) return { kind: "track", id: nearest.track.id };
    return null;
  }, []);

  /* ---------------- pointer handlers ---------------- */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const store = useTwinStore.getState();
      const world = screenToWorld(e.clientX, e.clientY);
      canvasRef.current?.setPointerCapture(e.pointerId);

      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
        dragRef.current = { mode: "pan", startScreen: { x: e.clientX, y: e.clientY }, startCam: { ...cameraRef.current } };
        return;
      }

      switch (store.tool) {
        case "select": {
          const hit = hitTest(store.network, world);
          if (hit?.id.includes("::vertex::")) {
            const [trackId, index] = hit.id.split("::vertex::");
            dragRef.current = { mode: "vertex", trackId, index: Number(index) };
          } else if (hit?.kind === "train") {
            dragRef.current = { mode: "train", trainId: hit.id };
            store.select(hit);
          } else if (hit?.kind === "station") {
            dragRef.current = { mode: "station", stationId: hit.id };
            store.select(hit);
          } else {
            store.select(hit);
            dragRef.current = { mode: "pan", startScreen: { x: e.clientX, y: e.clientY }, startCam: { ...cameraRef.current } };
          }
          break;
        }
        case "delete": {
          const hit = hitTest(store.network, world);
          if (hit) {
            const [kindId] = hit.id.split("::");
            store.deleteEntity(hit.kind, hit.kind === "track" ? kindId : hit.id);
          }
          break;
        }
        case "track": {
          if (!draftPointsRef.current) draftPointsRef.current = [world];
          else draftPointsRef.current.push(world);
          break;
        }
        case "station": {
          const id = store.createStation(world);
          store.select({ kind: "station", id });
          break;
        }
        case "signal":
        case "pole":
        case "crossing":
        case "train": {
          const nearest = findNearestTrack(store.network.tracks, world, SNAP_RADIUS);
          if (!nearest) {
            showToast(`Click on or near a line to place a ${PLACE_LABELS[store.tool]}.`);
            break;
          }
          const posM = Math.round(nearest.nearest.trackDistM);
          if (store.tool === "signal") {
            store.select({ kind: "signal", id: store.createSignal(nearest.track.id, posM) });
          } else if (store.tool === "pole") {
            store.select({ kind: "pole", id: store.createPole(nearest.track.id, posM) });
          } else if (store.tool === "crossing") {
            store.select({ kind: "crossing", id: store.createCrossing(nearest.track.id, posM) });
          } else {
            store.select({ kind: "train", id: store.createTrain(nearest.track.id, posM) });
          }
          break;
        }
      }
    },
    [hitTest, screenToWorld, showToast]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const world = screenToWorld(e.clientX, e.clientY);
      cursorWorldRef.current = world;
      const drag = dragRef.current;
      if (!drag) return;

      const store = useTwinStore.getState();
      if (drag.mode === "pan") {
        cameraRef.current.x = drag.startCam.x + (e.clientX - drag.startScreen.x);
        cameraRef.current.y = drag.startCam.y + (e.clientY - drag.startScreen.y);
      } else if (drag.mode === "station") {
        store.moveStation(drag.stationId, world);
      } else if (drag.mode === "train") {
        const nearest = findNearestTrack(store.network.tracks, world, Infinity);
        if (nearest && nearest.track.id === store.network.trains[drag.trainId]?.trackId) {
          store.moveTrain(drag.trainId, nearest.nearest.trackDistM);
        }
      } else if (drag.mode === "vertex") {
        const track = store.network.tracks[drag.trackId];
        if (!track) return;
        const points = track.points.map((pt, i) => (i === drag.index ? world : pt));
        store.reshapeTrack(drag.trackId, points);
      }
    },
    [screenToWorld]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const finishDraft = useCallback(() => {
    const draft = draftPointsRef.current;
    if (!draft || draft.length < 2) {
      draftPointsRef.current = null;
      return;
    }
    const store = useTwinStore.getState();
    const id = store.createTrack(`Track ${Object.keys(store.network.tracks).length + 1}`, "siding", draft);
    store.select({ kind: "track", id });
    draftPointsRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - cam.x) / cam.zoom;
    const wy = (my - cam.y) / cam.zoom;
    const zoom = Math.max(0.15, Math.min(5, cam.zoom * Math.exp(-e.deltaY * 0.0012)));
    cam.zoom = zoom;
    cam.x = mx - wx * zoom;
    cam.y = my - wy * zoom;
  }, []);

  const zoomAroundPoint = useCallback((factor: number, sx: number, sy: number) => {
    const cam = cameraRef.current;
    const wx = (sx - cam.x) / cam.zoom;
    const wy = (sy - cam.y) / cam.zoom;
    cam.zoom = Math.max(0.15, Math.min(5, cam.zoom * factor));
    cam.x = sx - wx * cam.zoom;
    cam.y = sy - wy * cam.zoom;
  }, []);

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAroundPoint(factor, rect.width / 2, rect.height / 2);
    },
    [zoomAroundPoint]
  );

  const fitView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const { tracks, stations } = useTwinStore.getState().network;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const track of Object.values(tracks)) {
      for (const pt of track.points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
    for (const station of Object.values(stations)) {
      minX = Math.min(minX, station.position.x);
      minY = Math.min(minY, station.position.y);
      maxX = Math.max(maxX, station.position.x);
      maxY = Math.max(maxY, station.position.y);
    }
    const pad = 80;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const zoom = Math.max(0.15, Math.min(5, Math.min(rect.width / bw, rect.height / bh)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    cameraRef.current = {
      x: rect.width / 2 - cx * zoom,
      y: rect.height / 2 - cy * zoom,
      zoom,
    };
  }, []);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (draftPointsRef.current) draftPointsRef.current = null;
        else useTwinStore.getState().select(null);
      } else if (e.key === "Enter") {
        finishDraft();
      } else if (e.key === "+" || e.key === "=") {
        zoomAtCenter(1.25);
      } else if (e.key === "-" || e.key === "_") {
        zoomAtCenter(0.8);
      } else if (e.key === "0") {
        fitView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishDraft, zoomAtCenter, fitView]);

  /* ---------------- render loop ---------------- */

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (!didInitRef.current && width > 0) {
        didInitRef.current = true;
        const zoom = Math.max(0.2, Math.min(width / 1450, height / 900)) * 0.92;
        cameraRef.current = {
          x: width / 2 - 790 * zoom,
          y: height / 2 - 470 * zoom,
          zoom,
        };
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const store = useTwinStore.getState();
      if (store.running) store.tick(dt);
      render();

      raf = requestAnimationFrame(frame);
    };

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      const cam = cameraRef.current;
      const store = useTwinStore.getState();
      const { network, selection, tool, activeEvents, clockMs } = store;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const worldW = cssW / cam.zoom;
      const worldH = cssH / cam.zoom;
      const wx0 = -cam.x / cam.zoom;
      const wy0 = -cam.y / cam.zoom;
      drawBackground(ctx, cssW, cssH, worldW, worldH, wx0, wy0);

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      drawNetwork(ctx, network, selection, cam.zoom, activeEvents, clockMs);

      // draft track preview
      const draft = draftPointsRef.current;
      if (draft && tool === "track") {
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 5;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(draft[0].x, draft[0].y);
        for (const pt of draft.slice(1)) ctx.lineTo(pt.x, pt.y);
        if (cursorWorldRef.current) ctx.lineTo(cursorWorldRef.current.x, cursorWorldRef.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const pt of draft) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#0284c7";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // placement ghosts
      const cursor = cursorWorldRef.current;
      if (cursor && !draft) {
        if (tool === "signal" || tool === "pole" || tool === "crossing" || tool === "train") {
          const nearest = findNearestTrack(network.tracks, cursor, SNAP_RADIUS);
          if (nearest) {
            const cum = cumulativeLengths(nearest.track.points);
            const { position, angle } = pointAtDistance(nearest.track.points, cum, nearest.nearest.trackDistM);
            ctx.globalAlpha = 0.55;
            if (tool === "signal") drawSignalNode(ctx, position, angle, "GREEN", false);
            else if (tool === "pole") drawPole(ctx, position, angle, cam.zoom, false);
            else if (tool === "crossing") drawLevelCrossing(ctx, position, false);
            else {
              ctx.beginPath();
              ctx.roundRect(position.x - 17, position.y - 8, 34, 16, 7);
              ctx.fillStyle = TRAIN_COLORS.PASSENGER;
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2.5;
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
        } else if (tool === "station") {
          ctx.globalAlpha = 0.5;
          drawStation(
            ctx,
            network,
            { id: "_ghost", name: "Station", position: cursor, platforms: 2 },
            false
          );
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#f8fafc]">
      <canvas
        ref={canvasRef}
        className="cursor-crosshair touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={finishDraft}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="absolute bottom-14 right-3 flex flex-col gap-1">
        <button
          onClick={() => zoomAtCenter(1.25)}
          title="Zoom in (+)"
          className="h-9 w-9 rounded-lg bg-white/95 text-lg font-bold text-slate-600 shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
        >
          +
        </button>
        <button
          onClick={() => zoomAtCenter(0.8)}
          title="Zoom out (−)"
          className="h-9 w-9 rounded-lg bg-white/95 text-lg font-bold text-slate-600 shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
        >
          −
        </button>
        <button
          onClick={fitView}
          title="Fit network in view (0)"
          className="h-9 w-9 rounded-lg bg-white/95 text-[10px] font-bold uppercase text-slate-600 shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
        >
          Fit
        </button>
      </div>

      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-white/10">
          {notice}
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/90 px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-200">
        Drag to pan · Scroll to zoom · Coloured dashes = planned route · Grey dashes = abandoned by diversion
      </div>
    </div>
  );
}
