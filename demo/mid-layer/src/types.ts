import { z } from "zod";

const trainSchema = z.object({
  id: z.string(),
  name: z.string(),
  line: z.enum(["UP", "DN"]),
  km: z.number(),
  speedKmh: z.number().nonnegative(),
  status: z.enum(["running", "delayed", "stopped"]),
  delayMinutes: z.number().nonnegative().optional(),
  nextSectionId: z.string(),
  heldSectionIds: z.array(z.string()).default([]),
});

const sectionSchema = z.object({
  id: z.string(),
  fromStation: z.string(),
  toStation: z.string(),
  fromKm: z.number(),
  toKm: z.number(),
  status: z.enum(["Clear", "Caution"]).default("Clear"),
  occupiedBy: z.string().optional(),
  fault: z.string().optional(),
});

export const worldSnapshotSchema = z.object({
  timestamp: z.string(),
  trains: z.array(trainSchema).default([]),
  sections: z.array(sectionSchema).default([]),
});
export type WorldSnapshot = z.infer<typeof worldSnapshotSchema>;

export interface MidLayerState {
  source: string;
  lastSeenAt?: string;
  lastForwardedAt?: string;
  lastForwardError?: string;
  snapshot?: WorldSnapshot;
}
