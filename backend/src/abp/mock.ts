/**
 * Deterministic mock ABP — the integration stand-in until the real ABP is
 * wired at Day N-1. Decides entirely from the request type and the affected
 * section's current reflected state.
 */

import type { AbpContext, AbpPort, AbpReply } from "./port.js";
import type { Request } from "../types.js";

export function buildMockAbp(): AbpPort {
  return {
    name: "mock",
    decide: async (request: Request, ctx: AbpContext): Promise<AbpReply> => {
      const state = ctx.sectionState(request.sectionId);
      switch (request.type) {
        case "section_entry": {
          if (state === "Block active") return { decision: "rerouted" };
          if (state === "Reserved" || state === "Queued" || state === "Approved") {
            return { decision: "queued" };
          }
          return { decision: "approved", grantedWindow: { startMin: 0, endMin: 90 } };
        }
        case "maintenance_block": {
          if (state === "Block active") return { decision: "queued" };
          return { decision: "approved", grantedWindow: { startMin: 0, endMin: 180 } };
        }
        case "running_status":
          return { decision: "approved" };
      }
    },
  };
}