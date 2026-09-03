export interface BlockRequest {
  id: string;
  department: "Engg" | "TRD" | "S&T";
  priority: "IMR" | "OBS" | "PM" | "Routine";
  description: string;
  section: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  confidence: number;
  shadow: string | null;
  trainsAffected: number;
  status: "Pending" | "Approved" | "Rejected" | "Active" | "Completed";
}

export interface MaintenanceRequest {
  id: string;
  department: "Engg" | "TRD" | "S&T";
  priority: "IMR" | "OBS" | "PM" | "Routine";
  description: string;
  section: string;
  requestedDate: string;
  requestedDuration: string;
  status: "Draft" | "Submitted" | "Under review" | "Scheduled";
  submittedBy: string;
}

export const mockBlockRequests: BlockRequest[] = [
  {
    id: "BLK-4521",
    department: "Engg",
    priority: "IMR",
    description: "Rail fracture repair at Km 245/3",
    section: "Km 244–248, UP",
    scheduledDate: "05 Sep 2026",
    scheduledTime: "14:00–16:00",
    duration: "2h 00m",
    confidence: 82,
    shadow: "TRD OHE inspection",
    trainsAffected: 1,
    status: "Pending",
  },
  {
    id: "BLK-4520",
    department: "S&T",
    priority: "PM",
    description: "Track circuit relay replacement (predicted failure)",
    section: "Km 250–252, DN",
    scheduledDate: "06 Sep 2026",
    scheduledTime: "10:00–12:30",
    duration: "2h 30m",
    confidence: 74,
    shadow: null,
    trainsAffected: 2,
    status: "Pending",
  },
  {
    id: "BLK-4519",
    department: "TRD",
    priority: "Routine",
    description: "OHE mast foundation inspection",
    section: "Km 238–241, UP",
    scheduledDate: "06 Sep 2026",
    scheduledTime: "11:00–13:00",
    duration: "2h 00m",
    confidence: 91,
    shadow: null,
    trainsAffected: 0,
    status: "Pending",
  },
  {
    id: "BLK-4518",
    department: "Engg",
    priority: "IMR",
    description: "OHE dropper snapped — power block required",
    section: "Km 239/2, UP",
    scheduledDate: "05 Sep 2026",
    scheduledTime: "08:00–09:30",
    duration: "1h 30m",
    confidence: 88,
    shadow: "S&T point machine lubrication",
    trainsAffected: 1,
    status: "Approved",
  },
  {
    id: "BLK-4517",
    department: "Engg",
    priority: "OBS",
    description: "Ballast deficiency rectification at LC approach",
    section: "Km 241/5, DN",
    scheduledDate: "07 Sep 2026",
    scheduledTime: "14:00–16:00",
    duration: "2h 00m",
    confidence: 79,
    shadow: null,
    trainsAffected: 1,
    status: "Pending",
  },
  {
    id: "BLK-4516",
    department: "S&T",
    priority: "Routine",
    description: "Signal lamp cleaning and replacement",
    section: "Km 243–246, UP/DN",
    scheduledDate: "08 Sep 2026",
    scheduledTime: "10:00–11:30",
    duration: "1h 30m",
    confidence: 95,
    shadow: null,
    trainsAffected: 0,
    status: "Pending",
  },
];

export const mockMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: "MR-1001",
    department: "Engg",
    priority: "IMR",
    description: "Rail fracture at Km 245/3 — urgent block needed",
    section: "Km 244–248, UP",
    requestedDate: "05 Sep 2026",
    requestedDuration: "2h 00m",
    status: "Under review",
    submittedBy: "SSE/P.Way/Ambala",
  },
  {
    id: "MR-1002",
    department: "TRD",
    priority: "Routine",
    description: "OHE mast foundation inspection — quarterly schedule",
    section: "Km 238–241, UP",
    requestedDate: "06 Sep 2026",
    requestedDuration: "2h 00m",
    status: "Submitted",
    submittedBy: "SSE/TRD/Ambala",
  },
  {
    id: "MR-1003",
    department: "S&T",
    priority: "PM",
    description: "Track circuit relay replacement — predicted failure in 14 days",
    section: "Km 250–252, DN",
    requestedDate: "06 Sep 2026",
    requestedDuration: "2h 30m",
    status: "Scheduled",
    submittedBy: "SSE/Sig/Saharanpur",
  },
  {
    id: "MR-1004",
    department: "Engg",
    priority: "OBS",
    description: "Weld defect observed at Km 248/1 during patrol",
    section: "Km 248/1, UP",
    requestedDate: "07 Sep 2026",
    requestedDuration: "1h 30m",
    status: "Draft",
    submittedBy: "SSE/P.Way/Ambala",
  },
  {
    id: "MR-1005",
    department: "Engg",
    priority: "OBS",
    description: "Ballast deficiency at level crossing approach",
    section: "Km 241/5, DN",
    requestedDate: "07 Sep 2026",
    requestedDuration: "2h 00m",
    status: "Submitted",
    submittedBy: "SSE/P.Way/Saharanpur",
  },
];

export const mockTrainPaths = [
  { id: "12005", name: "Kalka Shatabdi", time: "06:00", km: [238, 252], type: "Superfast" },
  { id: "14095", name: "Himalayan Queen", time: "12:10", km: [238, 252], type: "Mail/Express" },
  { id: "22455", name: "Rajdhani Express", time: "16:15", km: [238, 252], type: "Rajdhani" },
  { id: "FRT-4421", name: "BCNA Rake", time: "09:30", km: [240, 248], type: "Freight" },
  { id: "FRT-4422", name: "BOXN Rake", time: "14:45", km: [239, 250], type: "Freight" },
  { id: "FRT-4423", name: "Container Spl", time: "21:00", km: [238, 252], type: "Freight" },
];
