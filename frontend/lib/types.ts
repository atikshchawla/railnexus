/**
 * Core data types for RailNexus.
 * Category / Urgency / Status are ALWAYS three separate fields.
 */

// --- Category: classification from source system (IMR / OBS / PM) ---
export type Category = "IMR" | "OBS" | "PM";

// --- Urgency: AI-computed deadline or score ---
export interface Urgency {
  score: number;       // 0–100, drives queue order
  deadline: string;    // e.g. "2 days to SLA breach"
  level: "critical" | "high" | "medium" | "low";
}

// --- Workflow status ---
export type WorkflowStatus =
  | "Draft"
  | "Submitted"
  | "Under review"
  | "Approved"
  | "Scheduled"
  | "Active"
  | "Completed"
  | "Rejected";

// --- Data provenance ---
export interface Provenance {
  system: "TMS" | "SMMS" | "TDMS" | "COA" | "Manual";
  lastSynced: string; // e.g. "2m ago", "15m ago"
}

// --- Defect / maintenance backlog item ---
export interface BacklogItem {
  id: string;
  category: Category;
  urgency: Urgency;
  status: WorkflowStatus;
  department: "Engg" | "TRD" | "S&T";
  description: string;
  location: string;
  provenance: Provenance;
  hasConflict: boolean;
  conflictWith?: string;
}

// --- Block request ---
export interface BlockRequest {
  id: string;
  category: Category;
  urgency: Urgency;
  status: WorkflowStatus;
  department: "Engg" | "TRD" | "S&T";
  description: string;
  section: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  confidence: number;
  shadow: string | null;
  trainsAffected: { passenger: number; freight: number };
  hasConflict: boolean;
  conflictWith?: string;
  provenance: Provenance;
}

// --- AI suggestion constraint ---
export interface AiConstraint {
  label: string;
  met: boolean;
  detail?: string;
}

// --- AI suggestion ---
export interface AiSuggestion {
  id: string;
  summary: string;
  constraints: AiConstraint[];
  confidence: number;
  section: string;
  scheduledTime: string;
  department: "Engg" | "TRD" | "S&T";
  shadowDepts?: string[];
  notifyDepts?: string[];
}

// --- Conflict ---
export interface Conflict {
  id: string;
  blockA: { id: string; department: string; description: string; section: string; time: string };
  blockB: { id: string; department: string; description: string; section: string; time: string };
  overlapKm: string;
  overlapTime: string;
  resolved: boolean;
}

// --- Train path ---
export interface TrainPath {
  id: string;
  name: string;
  time: string;
  km: [number, number];
  type: "Superfast" | "Mail/Express" | "Rajdhani" | "Freight";
}

// --- Timeline block ---
export interface TimelineBlock {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
  department: "Engg" | "TRD" | "S&T";
  row: number; // stacking row to prevent overlap
}
