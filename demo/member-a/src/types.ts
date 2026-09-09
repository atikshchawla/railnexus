import { z } from "zod";

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

export const sectionSchema = z.object({
  id: z.string(),
  fromStation: z.string(),
  toStation: z.string(),
  fromKm: z.number(),
  toKm: z.number(),
  status: z.enum(["Clear", "Caution"]).default("Clear"),
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

export interface Station {
  code: string;
  name: string;
  km: number;
  latitude: number;
  longitude: number;
}

export interface NetworkSection {
  id: string;
  from: Station;
  to: Station;
  distanceKm: number;
  mpsKmh: number;
}

export interface LevelCrossing {
  id: string;
  sectionId: string;
  km: number;
  name: string;
}
