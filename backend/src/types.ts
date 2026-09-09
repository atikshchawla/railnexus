/**
 * RailNexus Member B — contract schemas.
 *
 * These are the frozen "Day 1" contracts for the demo split:
 *  - WORLD: what Member A publishes (world-state feed snapshots).
 *  - REQUEST: the single common schema all three departments speak to ABP in.
 *  - DECISION: what ABP sends back; SMMS reflects it into section state.
 *
 * Zod v3 is the single source of truth; TS types are inferred from it.
 */

import { z } from "zod";

// ─── Departments (Contributing Member) ───────────────────────────────
export const DEPARTMENT = ["TMS", "TDMS", "SMMS"] as const;
export const departmentSchema = z.enum(DEPARTMENT);
export type Department = z.infer<typeof departmentSchema>;

// ─── WORLD STATE FEED (Member A → Member B, read-only) ───────────────
export const lineSchema = z.enum(["UP", "DN"]);
export type Line = z.infer<typeof lineSchema>;

export const trainStatusSchema = z.enum(["running", "delayed", "stopped"]);
export type TrainStatus = z.infer<typeof trainStatusSchema>;

export const trainSchema = z.object({
  id: z.string(),
  name: z.string(),
  line: lineSchema,
  km: z.number(),
  speedKmh: z.number().nonnegative(),
  status: trainStatusSchema,
  delayMinutes: z.number().nonnegative().optional(),
  nextSectionId: z.string(),
  heldSectionIds: z.array(z.string()).default([]),
});
export type Train = z.infer<typeof trainSchema>;

export const sectionStatusSchema = z.enum(["Clear", "Caution"]);
export type SectionStatus = z.infer<typeof sectionStatusSchema>;

export const sectionSchema = z.object({
  id: z.string(),
  fromStation: z.string(),
  toStation: z.string(),
  fromKm: z.number(),
  toKm: z.number(),
  status: sectionStatusSchema.default("Clear"),
  occupiedBy: z.string().optional(),
  fault: z.string().optional(),
});
export type Section = z.infer<typeof sectionSchema>;

export const worldSnapshotSchema = z.object({
  timestamp: z.string(),
  trains: z.array(trainSchema).default([]),
  sections: z.array(sectionSchema).default([]),
});
export type WorldSnapshot = z.infer<typeof worldSnapshotSchema>;

// ─── COMMON REQUEST SCHEMA (Member B → ABP) ──────────────────────────
export const requestTypeSchema = z.enum([
  "running_status",
  "section_entry",
  "maintenance_block",
]);
export type RequestType = z.infer<typeof requestTypeSchema>;

export const requestSchema = z.object({
  id: z.string(),
  department: departmentSchema,
  type: requestTypeSchema,
  trainId: z.string().optional(),
  sectionId: z.string(),
  km: z.number(),
  payload: z.record(z.string(), z.unknown()).default({}),
  description: z.string(),
  raisedAt: z.string(),
  status: z.enum(["submitted", "decided"]).default("submitted"),
});
export type Request = z.infer<typeof requestSchema>;

// ─── QUERY INJECTOR (judge-facing, demo-work-split-v3.md §3.4) ────────
// A judge raises a request directly into ABP, indistinguishable from one the
// simulation raised on its own. Section/type are validated; payload is free.
export const queryInjectSchema = z.object({
  department: departmentSchema,
  type: requestTypeSchema,
  sectionId: z.string(),
  trainId: z.string().optional(),
  description: z.string().optional(),
  km: z.number().nonnegative().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type QueryInject = z.infer<typeof queryInjectSchema>;

// ─── ABP DECISION SCHEMA (ABP → Member B) ────────────────────────────
export const abpDecisionValueSchema = z.enum([
  "approved",
  "reserved",
  "queued",
  "rerouted",
  "rejected",
]);
export type AbpDecisionValue = z.infer<typeof abpDecisionValueSchema>;

export const windowSchema = z.object({
  startMin: z.number(),
  endMin: z.number(),
});
export type Window = z.infer<typeof windowSchema>;

export const abpReplySchema = z.object({
  decision: abpDecisionValueSchema,
  grantedWindow: windowSchema.optional(),
});
export type AbpReply = z.infer<typeof abpReplySchema>;

// Section state as reflected by ABP decisions (SMMS outcome display).
export const sectionStateSchema = z.enum([
  "Clear",
  "Caution",
  "Block active",
  "Approved",
  "Reserved",
  "Queued",
  "Rerouted",
]);
export type SectionState = z.infer<typeof sectionStateSchema>;

export const abpDecisionSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  decision: abpDecisionValueSchema,
  sectionId: z.string(),
  grantedWindow: windowSchema.optional(),
  sectionState: sectionStateSchema,
  decidedAt: z.string(),
});
export type AbpDecision = z.infer<typeof abpDecisionSchema>;

// ─── API STATE (Member B service → COA dashboard / proof page) ───────
export const sectionReflectionSchema = z.object({
  id: z.string(),
  fromStation: z.string(),
  toStation: z.string(),
  fromKm: z.number(),
  toKm: z.number(),
  state: sectionStateSchema,
  fault: z.string().optional(),
  occupiedBy: z.string().optional(),
});
export type SectionReflection = z.infer<typeof sectionReflectionSchema>;

export const feedInfoSchema = z.object({
  source: z.string(),
  lastSeenAt: z.string().optional(),
});
export type FeedInfo = z.infer<typeof feedInfoSchema>;

export const departmentViewSchema = z.object({
  department: departmentSchema,
  requests: z.array(requestSchema),
});
export type DepartmentView = z.infer<typeof departmentViewSchema>;

export const apiStateSchema = z.object({
  timestamp: z.string(),
  corridor: z.string(),
  sections: z.array(sectionReflectionSchema),
  departments: z.object({
    TMS: z.object({ requests: z.array(requestSchema) }),
    TDMS: z.object({ requests: z.array(requestSchema) }),
    SMMS: z.object({ requests: z.array(requestSchema) }),
  }),
  decisions: z.array(abpDecisionSchema),
  feed: feedInfoSchema,
});
export type ApiState = z.infer<typeof apiStateSchema>;

export interface InitialSection {
  id: string;
  fromStation: string;
  toStation: string;
  fromKm: number;
  toKm: number;
}