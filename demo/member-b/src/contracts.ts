import { z } from "zod";

export const worldStateSchema = z.object({
  tick: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  trains: z.array(z.object({
    train_id: z.string(),
    section_id: z.string(),
    position_km: z.number().nonnegative(),
    speed_kmph: z.number().nonnegative(),
    status: z.enum(["running", "delayed", "waiting", "stopped"]),
    delay_min: z.number().nonnegative(),
  })),
  sections: z.array(z.object({
    section_id: z.string(),
    occupant_train_id: z.string().nullable(),
    state: z.enum(["clear", "occupied", "maintenance", "reserved"]),
    fault_reason: z.string().nullable(),
  })),
});
export type WorldState = z.infer<typeof worldStateSchema>;

export const requestSchema = z.object({
  request_id: z.string().uuid(),
  department: z.enum(["TMS", "TDMS", "SMMS"]),
  type: z.enum(["running_status", "section_entry", "maintenance_block"]),
  train_id: z.string().nullable(),
  section_id: z.string(),
  description: z.string().min(1),
  raised_at: z.string().datetime(),
});
export type Request = z.infer<typeof requestSchema>;

export const decisionSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(["queued", "approved", "rerouted", "rejected"]),
  section_id: z.string(),
  resulting_state: z.enum(["clear", "occupied", "maintenance", "reserved"]),
  decided_at: z.string().datetime(),
  notes: z.string().optional(),
});
export type Decision = z.infer<typeof decisionSchema>;
