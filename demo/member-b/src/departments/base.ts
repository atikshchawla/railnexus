import type { Department, Request, WorldSnapshot } from "../types.js";
import type { Store } from "../store.js";

export interface EngineContext {
  now: () => string;
  nextRequestId: (department: Department) => string;
}

/**
 * A Member B department engine. Pure in the sense that it decides from a
 * world snapshot plus the store's history, and returns the requests it wants
 * to raise. No I/O.
 */
export interface DepartmentEngine {
  readonly department: Department;
  raise(snapshot: WorldSnapshot, ctx: EngineContext, store: Store): Request[];
}