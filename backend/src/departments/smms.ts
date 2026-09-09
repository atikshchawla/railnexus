/**
 * SMMS department — two jobs:
 *  - raising maintenance/fault requests from physical faults in the feed, and
 *  - reflecting ABP decisions into section state (handled in store.applyDecision
 *    via abp/applyDecision.ts).
 */

import type { DepartmentEngine, EngineContext } from "./base.js";
import type { Request, WorldSnapshot } from "../types.js";
import type { Store } from "../store.js";

export function buildSmmsEngine(): DepartmentEngine {
  return {
    department: "SMMS",
    raise(snapshot: WorldSnapshot, ctx: EngineContext, store: Store): Request[] {
      const requests: Request[] = [];
      for (const section of snapshot.sections) {
        const fault = section.fault;
        if (!fault) continue;
        if (store.getSectionState(section.id) === "Block active") continue;
        if (
          store.hasOpenRequest({
            department: "SMMS",
            type: "maintenance_block",
            sectionId: section.id,
          })
        ) {
          continue; // dedupe while a maintenance request is unresolved
        }
        requests.push({
          id: ctx.nextRequestId("SMMS"),
          department: "SMMS",
          type: "maintenance_block",
          sectionId: section.id,
          km: section.fromKm,
          payload: { fault },
          description: `Section ${section.id} requires emergency maintenance block`,
          raisedAt: ctx.now(),
          status: "submitted",
        });
      }
      return requests;
    },
  };
}