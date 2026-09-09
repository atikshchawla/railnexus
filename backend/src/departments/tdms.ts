/**
 * TDMS department — section-entry requests. Watches for a train about to need
 * a section it does not yet hold and raises a block-entry request for it: the
 * steady drumbeat of "ordinary" requests the demo runs on.
 */

import type { DepartmentEngine, EngineContext } from "./base.js";
import type { Request, WorldSnapshot } from "../types.js";
import type { Store } from "../store.js";

export function buildTdmsEngine(): DepartmentEngine {
  return {
    department: "TDMS",
    raise(snapshot: WorldSnapshot, ctx: EngineContext, store: Store): Request[] {
      const requests: Request[] = [];
      for (const train of snapshot.trains) {
        const nextSectionId = train.nextSectionId;
        if (!nextSectionId) continue;
        if (train.heldSectionIds.includes(nextSectionId)) continue;
        if (
          store.requestExists({
            department: "TDMS",
            type: "section_entry",
            trainId: train.id,
            sectionId: nextSectionId,
          })
        ) {
          continue; // dedupe: raise once per (train, section) pair
        }
        requests.push({
          id: ctx.nextRequestId("TDMS"),
          department: "TDMS",
          type: "section_entry",
          trainId: train.id,
          sectionId: nextSectionId,
          km: train.km,
          payload: { line: train.line, heldSections: train.heldSectionIds },
          description: `Train ${train.id} requests block entry into section ${nextSectionId}`,
          raisedAt: ctx.now(),
          status: "submitted",
        });
      }
      return requests;
    },
  };
}