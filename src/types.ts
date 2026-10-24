export type DriftType =
  | "none"
  | "blocked"
  | "stale_status"
  | "no_update"
  | "scope_change";

export type RiskLevel = "low" | "medium" | "high";

export type KanbanColumn =
  | "To Do"
  | "In Progress"
  | "In Review"
  | "QA"
  | "Done";

export interface Task {
  id: string;
  name: string;
  status: string;
  assignee: string;
  due_date: string | null;
  release: string;
}

export interface TaskAnalysis {
  task_id: string;
  mentioned_in_standup: boolean;
  spoken_status: string;
  drift: boolean;
  drift_type: DriftType;
  blockers: string[];
  risk_level: RiskLevel;
  evidence_quote: string;
  summary: string;
}

export interface EnrichedTask extends Task {
  normalizedStatus: KanbanColumn;
  dueInDays: number | null;
  analysis?: TaskAnalysis;
}

export interface BlockerEntry {
  taskId: string;
  taskName: string;
  owner: string;
  release: string;
  blocker: string;
  riskLevel: RiskLevel;
}
