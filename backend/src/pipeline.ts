/**
 * The Member B pipeline: world snapshot in → three departments decide whether
 * to raise → common-schema requests go to ABP → decisions come back → SMMS
 * reflects them into section state.
 */

import { applyDecisionState } from "./abp/applyDecision.js";
import type { AbpPort } from "./abp/port.js";
import type { DepartmentEngine, EngineContext } from "./departments/base.js";
import type { Store } from "./store.js";
import type {
  AbpDecision,
  QueryInject,
  Request,
  WorldSnapshot,
} from "./types.js";

export interface PipelineDeps {
  store: Store;
  engines: DepartmentEngine[];
  abp: AbpPort;
  now?: () => string;
}

export interface IngestResult {
  requests: Request[];
  decisions: AbpDecision[];
}

export interface InjectResult {
  request: Request;
  decision: AbpDecision;
}

export class QueryInjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryInjectError";
  }
}

export function buildPipeline(deps: PipelineDeps) {
  const now = deps.now ?? (() => new Date().toISOString());

  async function decideAndReflect(request: Request): Promise<AbpDecision> {
    const reply = await deps.abp.decide(request, {
      sectionState: (sectionId) => deps.store.getSectionState(sectionId),
    });
    const decision: AbpDecision = {
      id: `DEC-${request.id}`,
      requestId: request.id,
      decision: reply.decision,
      sectionId: request.sectionId,
      sectionState: applyDecisionState(
        request.type,
        reply.decision,
        deps.store.getSectionState(request.sectionId),
      ),
      decidedAt: now(),
    };
    if (reply.grantedWindow) {
      decision.grantedWindow = reply.grantedWindow;
    }
    deps.store.applyDecision(decision);
    return decision;
  }

  async function process(snapshot: WorldSnapshot): Promise<IngestResult> {
    deps.store.applyWorld(snapshot);
    deps.store.touchFeed(snapshot.timestamp);

    const ctx: EngineContext = {
      now,
      nextRequestId: (department) => deps.store.nextRequestId(department),
    };

    const raised: Request[] = [];
    for (const engine of deps.engines) {
      for (const request of engine.raise(snapshot, ctx, deps.store)) {
        deps.store.addRequest(request);
        raised.push(request);
      }
    }

    const decisions: AbpDecision[] = [];
    for (const request of raised) {
      decisions.push(await decideAndReflect(request));
    }

    return { requests: raised, decisions };
  }

  async function inject(input: QueryInject): Promise<InjectResult> {
    const section = deps.store.sectionBy(input.sectionId);
    if (!section) {
      throw new QueryInjectError(`unknown section: ${input.sectionId}`);
    }
    const request: Request = {
      id: deps.store.nextRequestId(input.department),
      department: input.department,
      type: input.type,
      sectionId: input.sectionId,
      km: input.km ?? section.fromKm,
      payload: input.payload ?? {},
      description: input.description ?? describeInject(input),
      raisedAt: now(),
      status: "submitted",
    };
    if (input.trainId) {
      request.trainId = input.trainId;
    }
    deps.store.addRequest(request);
    const decision = await decideAndReflect(request);
    return { request, decision };
  }

  return { process, inject };
}

/** Default description keeps injected requests worded like engine-raised ones. */
function describeInject(input: QueryInject): string {
  switch (input.type) {
    case "running_status":
      return `Train ${input.trainId ?? "(synthetic)"} requests priority handling due to delay`;
    case "section_entry":
      return `Train ${input.trainId ?? "(synthetic)"} requests block entry into section ${input.sectionId}`;
    case "maintenance_block":
      return `Section ${input.sectionId} requires emergency maintenance block`;
  }
}