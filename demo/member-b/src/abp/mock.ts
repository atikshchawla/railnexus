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
          return { decision: "queued" };
        }
        case "maintenance_block": {
          return { decision: "queued" };
        }
        case "running_status":
          return { decision: "queued" };
      }
    },
  };
}