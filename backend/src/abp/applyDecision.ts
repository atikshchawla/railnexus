/**
 * SMMS reflecting role — maps an ABP decision onto the affected section's
 * state, depending on the request type that produced it. running-status
 * decisions never change section state (they act on the train, not the track).
 */

import type { AbpDecisionValue, RequestType, SectionState } from "../types.js";

export function applyDecisionState(
  type: RequestType,
  decision: AbpDecisionValue,
  current: SectionState,
): SectionState {
  switch (decision) {
    case "approved":
      if (type === "running_status") return current;
      return type === "maintenance_block" ? "Block active" : "Approved";
    case "reserved":
      return "Reserved";
    case "queued":
      return "Queued";
    case "rerouted":
      return "Rerouted";
    case "rejected":
      return current;
  }
}