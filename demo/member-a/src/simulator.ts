import { corridorLabel, crossings, sectionById, sections, stations } from "./network.js";
import type { Section, Train, WorldSnapshot } from "./types.js";

interface SimTrain {
  id: string;
  name: string;
  line: "UP" | "DN";
  km: number;
  speedKmh: number;
  status: "running" | "delayed" | "stopped";
  delayMinutes: number;
}

export interface FaultState {
  sectionId: string;
  description: string;
}

export class WorldSimulator {
  private readonly trains: SimTrain[] = [
    { id: "12005", name: "Chennai–Mysuru Shatabdi", line: "UP", km: 8.4, speedKmh: 105, status: "running", delayMinutes: 0 },
    { id: "22601", name: "Chennai–Bengaluru Mail", line: "UP", km: 48.2, speedKmh: 82, status: "running", delayMinutes: 0 },
    { id: "12608", name: "Lalbagh Express", line: "DN", km: 137.2, speedKmh: 78, status: "running", delayMinutes: 0 },
  ];
  private faults = new Map<string, string>();
  private lastTick = Date.now();
  private tickCount = 0;

  snapshot(now = new Date()): WorldSnapshot {
    const sectionStates: Section[] = sections.map((section) => {
      const occupant = this.trains.find((train) => this.sectionFor(train)?.id === section.id);
      const fault = this.faults.get(section.id);
      const result: Section = {
        id: section.id,
        fromStation: section.from.name,
        toStation: section.to.name,
        fromKm: section.from.km,
        toKm: section.to.km,
        status: fault ? "Caution" : "Clear",
      };
      if (occupant) result.occupiedBy = occupant.id;
      if (fault) result.fault = fault;
      return result;
    });

    return {
      timestamp: now.toISOString(),
      trains: this.trains.map((train) => {
        const next = this.nextSectionFor(train);
        const result: Train = {
          id: train.id,
          name: train.name,
          line: train.line,
          km: Number(train.km.toFixed(3)),
          speedKmh: train.status === "stopped" ? 0 : train.speedKmh,
          status: train.status,
          nextSectionId: next?.id ?? (train.line === "UP" ? "JTJ-VN" : "AJJ-SHU"),
          heldSectionIds: this.heldSectionsFor(train),
        };
        if (train.delayMinutes > 0) result.delayMinutes = Number(train.delayMinutes.toFixed(1));
        return result;
      }),
      sections: sectionStates,
    };
  }

  tick(deltaSeconds?: number): WorldSnapshot {
    const now = Date.now();
    const elapsedSeconds = deltaSeconds ?? Math.max(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.tickCount += 1;
    const simulationSeconds = elapsedSeconds * this.timeScale;

    for (const train of this.trains) {
      if (this.faults.size > 0 && this.sectionFor(train) && this.faults.has(this.sectionFor(train)!.id)) {
        train.status = "stopped";
        train.delayMinutes += simulationSeconds / 60;
        continue;
      }
      train.status = train.delayMinutes >= 5 ? "delayed" : "running";
      if (train.status === "running") {
        const direction = train.line === "UP" ? 1 : -1;
        train.km += direction * train.speedKmh * simulationSeconds / 3600;
        train.km = this.wrapRoute(train.km, train.line);
      } else {
        train.delayMinutes += simulationSeconds / 120;
      }
    }
    if (this.tickCount % 45 === 0) {
      const candidate = this.trains[this.tickCount / 45 % this.trains.length]!;
      candidate.delayMinutes = Math.max(candidate.delayMinutes, 6);
    }
    return this.snapshot(new Date(now));
  }

  setFault(sectionId: string, description: string): FaultState {
    if (!sectionById(sectionId)) throw new Error(`Unknown section: ${sectionId}`);
    this.faults.set(sectionId, description);
    return { sectionId, description };
  }

  clearFault(sectionId: string): void {
    this.faults.delete(sectionId);
    for (const train of this.trains) {
      if (this.sectionFor(train)?.id === sectionId && train.status === "stopped") train.status = "running";
    }
  }

  network() {
    return { corridor: corridorLabel, stations, sections, crossings };
  }

  private readonly timeScale = Number(process.env.SIM_TIME_SCALE ?? 60);

  private sectionFor(train: SimTrain) {
    return sections.find((section) => train.km >= section.from.km && train.km < section.to.km);
  }

  private nextSectionFor(train: SimTrain) {
    const current = this.sectionFor(train);
    if (!current) return undefined;
    const index = sections.findIndex((section) => section.id === current.id);
    return train.line === "UP" ? sections[index + 1] ?? current : sections[index - 1] ?? current;
  }

  private heldSectionsFor(train: SimTrain): string[] {
    const current = this.sectionFor(train);
    return current ? [current.id] : [];
  }

  private wrapRoute(km: number, line: "UP" | "DN"): number {
    if (line === "UP" && km >= stations.at(-1)!.km) return stations[0]!.km + 1;
    if (line === "DN" && km <= stations[0]!.km) return stations.at(-1)!.km - 1;
    return km;
  }
}
