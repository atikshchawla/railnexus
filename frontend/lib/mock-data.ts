import type { Defect } from "@/components/dashboard/DefectsList";
import type { Proposal } from "@/components/dashboard/AiProposalCard";

/**
 * Mock data for the dashboard.
 * This file will be replaced by real API calls once the backend is ready.
 */

export const mockDefects: Defect[] = [
  {
    id: "4521",
    type: "IMR",
    location: "Km 245/3",
    description: "Rail fracture detected — urgent repair required",
    urgency: "2 days left",
    department: "Engg",
  },
  {
    id: "4520",
    type: "OBS",
    location: "Km 248/1",
    description: "Weld defect observed during routine patrol",
    urgency: "Routine",
    department: "Engg",
  },
  {
    id: "4519",
    type: "PM",
    location: "Km 252/7",
    description: "Track circuit degradation — RUL prediction: 14 days",
    urgency: "Scheduled",
    department: "S&T",
  },
  {
    id: "4518",
    type: "IMR",
    location: "Km 239/2",
    description: "OHE dropper snapped — power block needed",
    urgency: "1 day left",
    department: "TRD",
  },
  {
    id: "4517",
    type: "OBS",
    location: "Km 241/5",
    description: "Ballast deficiency at level crossing approach",
    urgency: "7 days",
    department: "Engg",
  },
  {
    id: "4516",
    type: "PM",
    location: "Km 250/0",
    description: "Signal relay response time increasing — predicted failure in 21 days",
    urgency: "Scheduled",
    department: "S&T",
  },
];

export const mockProposal: Proposal = {
  id: "BLK-4521",
  summary:
    "System proposes a 2-hour integrated block tomorrow at 14:00 hrs between Km 244 and Km 248. This utilizes an existing S&T corridor, saving 45 minutes of total downtime by combining Engineering rail repair with a shadow TRD OHE inspection.",
  confidence: 82,
  shadowBlocks: ["TRD OHE inspection"],
  trainsAffected: { passenger: 0, freight: 1 },
  section: "Km 244–248, UP line",
  scheduledTime: "Tomorrow, 14:00–16:00",
  department: "Engg",
};

export const mockKpis = [
  { label: "Pending blocks", value: 5, subtext: "+2 from yesterday" },
  { label: "Active blocks", value: 2, subtext: "On schedule" },
  { label: "Shadow utilization", value: "38%", subtext: "+12% vs last week" },
  { label: "Today's completion", value: "45%", subtext: "9 of 20 tasks done" },
];
