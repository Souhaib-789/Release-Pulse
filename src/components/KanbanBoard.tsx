import { useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import type { EnrichedTask, RiskLevel } from "../types";
import {
  formatDriftTypeLabel,
  formatDueLabel,
  KANBAN_COLUMNS,
} from "../utils/releaseHelpers";

interface KanbanBoardProps {
  tasks: EnrichedTask[];
  isLoadingTasks: boolean;
  isAnalyzing: boolean;
  selectedTaskId: string | null;
  onSelectTask: (task: EnrichedTask) => void;
}

type BoardFilter = "all" | "drift" | "high_risk";

function RiskBadge({ risk }: { risk: RiskLevel }) {
  if (risk === "high") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 rounded whitespace-nowrap shrink-0">
        High risk
      </span>
    );
  }
  if (risk === "medium") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded whitespace-nowrap shrink-0">
        Med risk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded whitespace-nowrap shrink-0">
      Low risk
    </span>
  );
}

export function KanbanBoard({
  tasks,
  isLoadingTasks,
  isAnalyzing,
  selectedTaskId,
  onSelectTask,
}: KanbanBoardProps) {
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = tasks.filter((task) => {
    if (boardFilter === "drift" && !task.analysis?.drift) return false;
    if (boardFilter === "high_risk" && task.analysis?.risk_level !== "high") {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        task.id.toLowerCase().includes(q) ||
        task.name.toLowerCase().includes(q) ||
        task.assignee.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <section id="pipeline-board" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Release Pipeline Board
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Columns reflect official ClickUp status. Click any ticket to compare
            ClickUp vs. spoken standup status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search input */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticket or owner..."
              aria-label="Search pipeline tickets"
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none w-48"
            />
          </div>

          {/* Segmented filter buttons */}
          <div
            role="group"
            aria-label="Filter pipeline tickets"
            className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setBoardFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                boardFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setBoardFilter("drift")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                boardFilter === "drift"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Drifted only
            </button>
            <button
              type="button"
              onClick={() => setBoardFilter("high_risk")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                boardFilter === "high_risk"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              High risk
            </button>
          </div>
        </div>
      </div>

      {isLoadingTasks ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {KANBAN_COLUMNS.map((col) => (
            <div
              key={col}
              className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 space-y-3"
            >
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-24 bg-white rounded-lg border border-slate-200 animate-pulse" />
              <div className="h-24 bg-white rounded-lg border border-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
          {KANBAN_COLUMNS.map((column) => {
            const colTasks = filteredTasks.filter(
              (t) => t.normalizedStatus === column
            );

            return (
              <div
                key={column}
                className="bg-slate-100/75 border border-slate-200/80 rounded-xl p-3 min-h-[220px] flex flex-col"
              >
                <div className="flex items-center justify-between gap-2 px-1 pb-2.5 mb-2.5 border-b border-slate-200/80">
                  <h3 className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {column}
                  </h3>
                  <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                    {colTasks.length}
                  </span>
                </div>

                {colTasks.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-8 px-2 text-center">
                    <p className="text-xs text-slate-400">
                      No tickets in {column}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {colTasks.map((task) => {
                      const isDone = task.normalizedStatus === "Done";
                      const dueInfo = formatDueLabel(
                        task.due_date,
                        task.dueInDays,
                        isDone
                      );
                      const isSelected = selectedTaskId === task.id;
                      const hasDrift = task.analysis?.drift === true;

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onSelectTask(task)}
                          className={`w-full text-left bg-white rounded-lg p-3.5 border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            isSelected
                              ? "border-blue-600 ring-1 ring-blue-600/20"
                              : hasDrift
                                ? "border-red-300 hover:border-red-400"
                                : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* Top row: Ticket ID + Drift badge */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-mono text-[11px] font-medium text-slate-500 tabular-nums">
                              {task.id}
                            </span>

                            {hasDrift && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded whitespace-nowrap shrink-0">
                                <AlertCircle
                                  className="w-3 h-3 text-red-600"
                                  aria-hidden="true"
                                />
                                <span>Drift</span>
                              </span>
                            )}
                          </div>

                          {/* Primary Ticket Title */}
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {task.name}
                          </p>

                          {/* Unboxed metadata with typographic separator */}
                          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                            <span className="font-medium text-slate-700">
                              {task.assignee}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                dueInfo.isUrgent
                                  ? "text-amber-700 font-medium"
                                  : "text-slate-500"
                              }
                            >
                              {dueInfo.text}
                            </span>
                          </div>

                          {/* Analysis footer */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                            {isAnalyzing ? (
                              <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                            ) : task.analysis ? (
                              <>
                                <RiskBadge risk={task.analysis.risk_level} />
                                {hasDrift && (
                                  <span className="text-[11px] font-medium text-red-700 truncate">
                                    {formatDriftTypeLabel(
                                      task.analysis.drift_type
                                    )}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Not analyzed yet
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
