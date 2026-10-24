import type {
  BlockerEntry,
  DriftType,
  EnrichedTask,
  KanbanColumn,
  RiskLevel,
  Task,
  TaskAnalysis,
} from "../types";

export const KANBAN_COLUMNS: KanbanColumn[] = [
  "To Do",
  "In Progress",
  "In Review",
  "QA",
  "Done",
];

export function normalizeToKanbanColumn(status: string): KanbanColumn {
  const s = status.trim().toLowerCase();
  if (s === "to do" || s === "todo" || s === "open" || s === "backlog") {
    return "To Do";
  }
  if (s === "in progress" || s === "doing" || s === "active") {
    return "In Progress";
  }
  if (s === "in review" || s === "review" || s === "code review") {
    return "In Review";
  }
  if (s === "qa" || s === "ready for qa" || s === "testing") {
    return "QA";
  }
  if (
    s === "done" ||
    s === "released" ||
    s === "complete" ||
    s === "completed" ||
    s === "closed"
  ) {
    return "Done";
  }
  return "To Do";
}

export function isProgressCompleteStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s === "done" ||
    s === "released" ||
    s === "ready for qa" ||
    s === "qa" ||
    s === "complete" ||
    s === "completed" ||
    s === "closed"
  );
}

export function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const parsed = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((parsed.getTime() - now.getTime()) / 86_400_000);
}

export function formatDueLabel(
  dueDate: string | null,
  dueInDays: number | null,
  isDone: boolean
): { text: string; isUrgent: boolean } {
  if (!dueDate || dueInDays === null) {
    return { text: "No due date", isUrgent: false };
  }

  const parsed = new Date(`${dueDate}T12:00:00`);
  const shortDate = parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (isDone) {
    return { text: `Due ${shortDate}`, isUrgent: false };
  }
  if (dueInDays < 0) {
    return {
      text: `${Math.abs(dueInDays)}d overdue (${shortDate})`,
      isUrgent: true,
    };
  }
  if (dueInDays === 0) {
    return { text: `Due today (${shortDate})`, isUrgent: true };
  }
  if (dueInDays <= 3) {
    return { text: `Due in ${dueInDays}d (${shortDate})`, isUrgent: true };
  }
  return { text: `Due in ${dueInDays}d (${shortDate})`, isUrgent: false };
}

export function enrichTasks(
  tasks: Task[],
  analysisMap: Map<string, TaskAnalysis>
): EnrichedTask[] {
  return tasks.map((task) => ({
    ...task,
    normalizedStatus: normalizeToKanbanColumn(task.status),
    dueInDays: getDaysUntilDue(task.due_date),
    analysis: analysisMap.get(task.id),
  }));
}

export function riskSortWeight(risk: RiskLevel | undefined): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  if (risk === "low") return 1;
  return 0;
}

export function formatDriftTypeLabel(driftType: DriftType): string {
  switch (driftType) {
    case "blocked":
      return "Blocked in Standup";
    case "stale_status":
      return "Stale ClickUp Status";
    case "no_update":
      return "No Standup Update";
    case "scope_change":
      return "Scope Change";
    default:
      return "Aligned";
  }
}

export function extractAllBlockers(tasks: EnrichedTask[]): BlockerEntry[] {
  const entries: BlockerEntry[] = [];
  for (const task of tasks) {
    if (!task.analysis || task.analysis.blockers.length === 0) continue;
    for (const blocker of task.analysis.blockers) {
      entries.push({
        taskId: task.id,
        taskName: task.name,
        owner: task.assignee,
        release: task.release,
        blocker,
        riskLevel: task.analysis.risk_level,
      });
    }
  }
  return entries.sort(
    (a, b) => riskSortWeight(b.riskLevel) - riskSortWeight(a.riskLevel)
  );
}
