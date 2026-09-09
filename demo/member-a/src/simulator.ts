import { corridorLabel, crossings, sectionById, sections, stations } from "./network.js";
import type { WorldState } from "./contracts.js";

interface SimTrain {
  train_id: string;
  name: string;
  direction: "UP" | "DN";
  sectionIndex: number;
  positionKm: number;
  speedKmph: number;
  status: "running" | "delayed" | "waiting" | "stopped";
  delayMin: number;
}

export interface FaultState { sectionId: string; description: string }

export class WorldSimulator {
  private readonly trains: SimTrain[] = [
    ["12005", "Chennai-Mysuru Shatabdi", "UP", 0, 4, 100], ["22601", "Chennai-Bengaluru Mail", "UP", 1, 28, 82],
    ["12608", "Lalbagh Express", "DN", 7, 126, 78], ["16085", "Mysuru Express", "DN", 6, 104, 72],
    ["16526", "Kanyakumari Express", "UP", 2, 39, 70], ["12640", "Brindavan Express", "DN", 5, 98, 85],
    ["22638", "West Coast Express", "UP", 3, 47, 76], ["16519", "Guruvayur Express", "DN", 4, 78, 68],
  ].map(([train_id, name, direction, sectionIndex, positionKm, speedKmph]) => ({
    train_id: String(train_id), name: String(name), direction: direction as "UP" | "DN",
    sectionIndex: Number(sectionIndex), positionKm: Number(positionKm), speedKmph: Number(speedKmph), status: "running", delayMin: 0,
  }));
  private faults = new Map<string, { reason: string; remainingTicks: number }>();
  private tickCount = 0;
  private lastTick = Date.now();
  private readonly timeScale = Number(process.env.SIM_TIME_SCALE ?? 30);

  snapshot(now = new Date()): WorldState {
    const occupied = new Map<string, string>();
    for (const train of this.trains) occupied.set(sections[train.sectionIndex]!.id, train.train_id);
    return {
      tick: this.tickCount, timestamp: now.toISOString(),
      trains: this.trains.map((train) => {
        const section = sections[train.sectionIndex]!;
        return { train_id: train.train_id, section_id: section.id, position_km: Number((train.positionKm - section.from.km).toFixed(3)), speed_kmph: train.status === "stopped" || train.status === "waiting" ? 0 : train.speedKmph, status: train.status, delay_min: Number(train.delayMin.toFixed(1)) };
      }),
      sections: sections.map((section) => {
        const fault = this.faults.get(section.id); const occupant_train_id = occupied.get(section.id) ?? null;
        return { section_id: section.id, occupant_train_id, state: fault ? "maintenance" : occupant_train_id ? "occupied" : "clear", fault_reason: fault?.reason ?? null };
      }),
    };
  }

  tick(deltaSeconds?: number): WorldState {
    const now = Date.now(); const elapsed = deltaSeconds ?? Math.max(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now; this.tickCount += 1;
    for (const train of this.trains) this.advance(train, elapsed * this.timeScale);
    for (const [id, fault] of this.faults) { fault.remainingTicks -= 1; if (fault.remainingTicks <= 0) this.faults.delete(id); }
    if (this.tickCount % 40 === 0) { const train = this.trains[this.tickCount / 40 % this.trains.length]!; train.delayMin = Math.max(train.delayMin, 6); train.status = "delayed"; }
    return this.snapshot(new Date(now));
  }

  setFault(sectionId: string, type: string, durationTicks: number): FaultState {
    if (!sectionById(sectionId)) throw new Error(`Unknown section: ${sectionId}`);
    const description = type.trim() || "Physical track unavailable";
    this.faults.set(sectionId, { reason: description, remainingTicks: Math.max(1, durationTicks) });
    return { sectionId, description };
  }

  clearFault(sectionId: string): void { this.faults.delete(sectionId); }
  network() { return { corridor: corridorLabel, stations, sections, crossings }; }

  private advance(train: SimTrain, simulatedSeconds: number): void {
    const section = sections[train.sectionIndex]!; const direction = train.direction === "UP" ? 1 : -1;
    const target = train.positionKm + direction * train.speedKmph * simulatedSeconds / 3600;
    const atBoundary = direction === 1 ? target >= section.to.km : target <= section.from.km;
    if (!atBoundary) { train.positionKm = target; train.status = train.delayMin >= 5 ? "delayed" : "running"; return; }
    const nextIndex = train.sectionIndex + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) { train.sectionIndex = direction === 1 ? 0 : sections.length - 1; train.positionKm = direction === 1 ? sections[0]!.from.km + .1 : sections.at(-1)!.to.km - .1; train.status = "running"; return; }
    const next = sections[nextIndex]!; const occupied = this.trains.some((candidate) => candidate !== train && candidate.sectionIndex === nextIndex);
    if (occupied || this.faults.has(next.id)) { train.positionKm = direction === 1 ? section.to.km : section.from.km; train.status = this.faults.has(next.id) ? "stopped" : "waiting"; train.delayMin += simulatedSeconds / 60; return; }
    train.sectionIndex = nextIndex; train.positionKm = direction === 1 ? next.from.km + .05 : next.to.km - .05; train.status = train.delayMin >= 5 ? "delayed" : "running";
  }
}
