import { polylineLength } from "./geometry";
import type {
  OhePole,
  RailwayNetwork,
  Signal,
  Station,
  Track,
  Train,
} from "./types";

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeTrack(
  id: string,
  name: string,
  kind: Track["kind"],
  points: Track["points"],
  color?: string
): Track {
  return { id, name, kind, points, lengthM: polylineLength(points), color };
}

export function addTrack(network: RailwayNetwork, track: Track): void {
  network.tracks[track.id] = track;
}

export function addStation(network: RailwayNetwork, station: Station): void {
  network.stations[station.id] = station;
}

export function addSignal(network: RailwayNetwork, signal: Signal): void {
  network.signals[signal.id] = signal;
}

export function addPole(network: RailwayNetwork, pole: OhePole): void {
  network.poles[pole.id] = pole;
}

export function addTrain(network: RailwayNetwork, train: Train): void {
  network.trains[train.id] = train;
}

/** Remove a track and everything anchored to it (signals, poles, crossings, trains). */
export function removeTrack(network: RailwayNetwork, trackId: string): void {
  delete network.tracks[trackId];
  for (const [id, signal] of Object.entries(network.signals)) {
    if (signal.trackId === trackId) delete network.signals[id];
  }
  for (const [id, pole] of Object.entries(network.poles)) {
    if (pole.trackId === trackId) delete network.poles[id];
  }
  for (const [id, crossing] of Object.entries(network.crossings)) {
    if (crossing.trackId === trackId) delete network.crossings[id];
  }
  for (const [id, train] of Object.entries(network.trains)) {
    if (train.trackId === trackId) delete network.trains[id];
  }
}
