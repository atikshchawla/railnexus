export type BlockPriority = "IMR" | "OBS" | "PM" | "Routine";

export type BlockRequestStatus = "Pending" | "Approved" | "Rejected" | "Active" | "Completed";

export interface BlockRequest {
  id: string;
  priority: BlockPriority;
  department: string;
  description: string;
  section: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  confidence: number;
  shadow?: string;
  status: BlockRequestStatus;
}

export type MaintenanceRequestStatus = "Draft" | "Submitted" | "Under review" | "Scheduled";

export interface MaintenanceRequest {
  id: string;
  priority: BlockPriority;
  department: string;
  description: string;
  section: string;
  requestedDate: string;
  requestedDuration: string;
  submittedBy: string;
  status: MaintenanceRequestStatus;
}