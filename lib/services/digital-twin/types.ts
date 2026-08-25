export interface Vec2 {
  x: number;
  y: number;
}

export type TrackKind = "up" | "down" | "loop" | "siding";

export type SignalAspect = "RED" | "YELLOW" | "DOUBLE_YELLOW" | "GREEN";

export type TrainKind = "PASSENGER" | "EXPRESS" | "FREIGHT";

export type TrainStatus = "RUNNING" | "HALTED" | "OUT_OF_SERVICE";

export type DisasterKind =
  | "BROKEN_TRACK"
  | "FLOODING"
  | "SIGNAL_FAILURE"
  | "OHE_FAULT"
  | "MIXED_SCHEDULE";

export interface DisasterEvent {
  id: string;
  kind: DisasterKind;
  label: string;
  createdAtMs: number;
  trackId?: string;
  signalId?: string;
  positionM?: number;
  /** Trains on the target when the event was triggered. */
  affectedTrains?: number;
}

/** A railway track (line) as an ordered polyline in world units (metres). */
export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  points: Vec2[];
  /** Cached cumulative length in metres. */
  lengthM: number;
  /** Line colour for schematic rendering; falls back by kind. */
  color?: string;
}

export interface Station {
  id: string;
  name: string;
  position: Vec2;
  platforms: number;
}

/** Signal anchored to a track at a distance along it. */
export interface Signal {
  id: string;
  name: string;
  trackId: string;
  positionM: number;
  aspect: SignalAspect;
}

/** OHE (electrical) pole anchored to a track at a distance along it. */
export interface OhePole {
  id: string;
  name: string;
  trackId: string;
  positionM: number;
}

/** Level crossing anchored to a track at a distance along it. */
export interface LevelCrossing {
  id: string;
  name: string;
  trackId: string;
  positionM: number;
}

/** Train bound to its current track by id + distance along that track. */
export interface Train {
  id: string;
  name: string;
  kind: TrainKind;
  status: TrainStatus;
  trackId: string;
  /** Distance travelled along the current track, in metres. */
  positionM: number;
  direction: 1 | -1;
  /** Cruise speed in km/h. */
  speedKmph: number;
  /** Train identity colour used for its planned-route overlay. */
  color: string;
  /** The route as originally planned — greyed out segment-by-segment when a diversion drops parts of it. */
  originalRoute: string[];
  /** Station the train is heading to. */
  destinationStationId: string;
  /** Remaining tracks to traverse; route[0] is the current track. */
  route: string[];
  /** Sim clock time (ms) when a dwell/reaction ends. */
  resumeAtMs?: number;
  /** What the train plans to do when its timer expires. */
  pendingAction?: "reroute" | "depart" | "nextDest";
  /** Human-readable current action/state note. */
  haltReason?: string;
  /** Set when the controller (user) holds the train — never auto-resumed. */
  manualHold?: boolean;
  /** Station just departed — ignored as a stop until the train passes it. */
  lastStationId?: string;
  /** True while the train is running a calamity diversion instead of its original plan. */
  diverted?: boolean;
  /** Sim clock of the last single-line turnback (anti ping-pong cooldown). */
  lastTurnbackMs?: number;
}

export interface LogEntry {
  id: number;
  timeMs: number;
  text: string;
  kind: "info" | "warn" | "success" | "train";
}

export interface RailwayNetwork {
  id: string;
  name: string;
  tracks: Record<string, Track>;
  stations: Record<string, Station>;
  signals: Record<string, Signal>;
  poles: Record<string, OhePole>;
  crossings: Record<string, LevelCrossing>;
  trains: Record<string, Train>;
}

export type EntityKind = "track" | "station" | "signal" | "pole" | "crossing" | "train";

export interface Selection {
  kind: EntityKind;
  id: string;
}

export type Tool =
  | "select"
  | "track"
  | "station"
  | "signal"
  | "pole"
  | "crossing"
  | "train"
  | "delete";
