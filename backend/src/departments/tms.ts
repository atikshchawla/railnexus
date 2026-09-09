/**
 * TMS department — running-status requests. Watches for a train running late
 * past a threshold and raises a priority request on its behalf.
 */

import type { DepartmentEngine, EngineContext } from "./base.js";
import type { Request, WorldSnapshot } from "../types.js";
import type { Store } from "../store.js";

/** Project-defined threshold; record in docs/domain-glossary.md. */
export const DELAY_THRESHOLD_MINUTES = 10;

export function buildTmsEngine(): DepartmentEngine {
  return {
    department: "TMS",
    raise(snapshot: WorldSnapshot, ctx: EngineContext, store: Store): Request[] {
      const requests: Request[] = [];
      for (const train of snapshot.trains) {
        if (train.status !== "delayed") continue;
        const delayMinutes = train.delayMinutes ?? 0;
        if (delayMinutes < DELAY_THRESHOLD_MINUTES) continue;
        if (
          store.requestExists({
            department: "TMS",
            type: "running_status",
            trainId: train.id,
          })
        ) {
          continue; // dedupe: one running-status request per train per episode
        }
        requests.push({
          id: ctx.nextRequestId("TMS"),
          department: "TMS",
          type: "running_status",
          trainId: train.id,
          sectionId: train.nextSectionId,
          km: train.km,
          payload: { delayMinutes, line: train.line },
          description: `Train ${train.id} requests priority handling due to ${delayMinutes} min delay`,
          raisedAt: ctx.now(),
          status: "submitted",
        });
      }
      return requests;
    },
  };
}