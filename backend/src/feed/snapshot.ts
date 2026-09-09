import { worldSnapshotSchema } from "../types.js";
import type { WorldSnapshot } from "../types.js";

/** Runtime validation of anything claiming to be a world-state snapshot. */
export function parseSnapshot(input: unknown): WorldSnapshot {
  return worldSnapshotSchema.parse(input);
}