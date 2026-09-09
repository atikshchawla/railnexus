/**
 * In-memory store for Member B's slice of the world:
 *  - corridor section reflections (the SMMS outcome display)
 *  - the common request log, per department
 *  - ABP decisions (latest N kept)
 *  - feed health (source label + last seen time)
 *
 * Demo-scope only; no persistence.
 */

import { applyDecisionState } from "./abp/applyDecision.js";
import type {
  AbpDecision,
  ApiState,
  Department,
  FeedInfo,
  InitialSection,
  Request,
  RequestType,
  SectionReflection,
  SectionState,
  WorldSnapshot,
} from "./types.js";

export interface RequestMatcher {
  department?: Department;
  type?: RequestType;
  trainId?: string;
  sectionId?: string;
}

const MAX_DECISIONS = 200;

export class Store {
  private readonly sections = new Map<string, SectionReflection>();
  private readonly requests: Request[] = [];
  private readonly decisions: AbpDecision[] = [];
  private readonly feed: FeedInfo = { source: "idle" };
  private seq = 0;

  constructor(
    private readonly corridorLabel: string,
    initialSections: InitialSection[],
  ) {
    for (const section of initialSections) {
      this.seedSection(section);
    }
  }

  // ─── World application ─────────────────────────────────────────────
  applyWorld(snapshot: WorldSnapshot): void {
    for (const world of snapshot.sections) {
      const existing = this.sections.get(world.id);
      if (!existing) {
        this.seedSection({
          id: world.id,
          fromStation: world.fromStation,
          toStation: world.toStation,
          fromKm: world.fromKm,
          toKm: world.toKm,
        });
      }
      const current = this.sections.get(world.id)!;
      setOptional(current, "fault", world.fault);
      setOptional(current, "occupiedBy", world.occupiedBy);
    }
  }

  // ─── Requests ──────────────────────────────────────────────────────
  nextRequestId(department: Department): string {
    this.seq += 1;
    return `REQ-${department}-${this.seq}`;
  }

  addRequest(request: Request): void {
    this.requests.push(request);
  }

  requestExists(matcher: RequestMatcher): boolean {
    return this.requests.some((request) => matches(request, matcher));
  }

  hasOpenRequest(matcher: RequestMatcher): boolean {
    return this.requests.some(
      (request) => request.status === "submitted" && matches(request, matcher),
    );
  }

  requestsFor(department: Department): Request[] {
    return this.requests.filter((request) => request.department === department);
  }

  // ─── Decisions ─────────────────────────────────────────────────────
  applyDecision(decision: AbpDecision): void {
    const request = this.requests.find(
      (candidate) => candidate.id === decision.requestId,
    );
    if (request) {
      const section = this.sections.get(decision.sectionId);
      if (section) {
        section.state = applyDecisionState(
          request.type,
          decision.decision,
          section.state,
        );
      }
      request.status = "decided";
    }
    this.decisions.push(decision);
    if (this.decisions.length > MAX_DECISIONS) {
      this.decisions.splice(0, this.decisions.length - MAX_DECISIONS);
    }
  }

  // ─── Feed health ───────────────────────────────────────────────────
  setFeedSource(source: string): void {
    this.feed.source = source;
  }

  touchFeed(at: string): void {
    this.feed.lastSeenAt = at;
  }

  // ─── Read / snapshot ───────────────────────────────────────────────
  getSectionState(sectionId: string): SectionState {
    return this.sections.get(sectionId)?.state ?? "Clear";
  }

  sectionBy(sectionId: string): SectionReflection | undefined {
    return this.sections.get(sectionId);
  }

  allSections(): SectionReflection[] {
    return [...this.sections.values()];
  }

  latestDecisions(): AbpDecision[] {
    return [...this.decisions];
  }

  snapshotState(): ApiState {
    return {
      timestamp: new Date().toISOString(),
      corridor: this.corridorLabel,
      sections: this.allSections(),
      departments: {
        TMS: { requests: this.requestsFor("TMS") },
        TDMS: { requests: this.requestsFor("TDMS") },
        SMMS: { requests: this.requestsFor("SMMS") },
      },
      decisions: this.latestDecisions(),
      feed: { ...this.feed },
    };
  }

  private seedSection(section: InitialSection): void {
    this.sections.set(section.id, {
      id: section.id,
      fromStation: section.fromStation,
      toStation: section.toStation,
      fromKm: section.fromKm,
      toKm: section.toKm,
      state: "Clear",
    });
  }
}

function matches(request: Request, matcher: RequestMatcher): boolean {
  return (
    (matcher.department === undefined || request.department === matcher.department) &&
    (matcher.type === undefined || request.type === matcher.type) &&
    (matcher.trainId === undefined || request.trainId === matcher.trainId) &&
    (matcher.sectionId === undefined || request.sectionId === matcher.sectionId)
  );
}

function setOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}