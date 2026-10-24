import { AlertTriangle, Ban, ChevronRight, ShieldCheck } from "lucide-react";
import type { EnrichedTask } from "../types";
import {
  extractAllBlockers,
  formatDriftTypeLabel,
  riskSortWeight,
} from "../utils/releaseHelpers";

interface AttentionAndBlockersProps {
  tasks: EnrichedTask[];
  hasAnalyzed: boolean;
  isAnalyzing: boolean;
  onSelectTaskById: (taskId: string) => void;
}

export function AttentionAndBlockers({
  tasks,
  hasAnalyzed,
  isAnalyzing,
  onSelectTaskById,
}: AttentionAndBlockersProps) {
  const attentionTasks = tasks
    .filter(
      (t) =>
        t.analysis &&
        (t.analysis.risk_level === "high" || t.analysis.drift === true)
    )
    .sort((a, b) => {
      const riskDiff =
        riskSortWeight(b.analysis?.risk_level) -
        riskSortWeight(a.analysis?.risk_level);
      if (riskDiff !== 0) return riskDiff;
      if (a.analysis?.drift !== b.analysis?.drift) {
        return a.analysis?.drift ? -1 : 1;
      }
      return (a.dueInDays ?? 999) - (b.dueInDays ?? 999);
    });

  const blockers = extractAllBlockers(tasks);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 6. Needs Attention Panel */}
      <section
        id="needs-attention"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="w-4 h-4 text-red-600 shrink-0"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold text-slate-900">
              Needs Attention
            </h2>
          </div>
          {hasAnalyzed && (
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
              {attentionTasks.length}{" "}
              {attentionTasks.length === 1 ? "ticket" : "tickets"}
            </span>
          )}
        </div>

        {isAnalyzing ? (
          <div className="py-4 space-y-3">
            <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : !hasAnalyzed ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-600 font-medium">
              No drift analysis run yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click <span className="font-semibold text-slate-700">Analyze release</span>{" "}
              above to flag high-risk tickets and mismatches between ClickUp and
              standup notes.
            </p>
          </div>
        ) : attentionTasks.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center">
            <ShieldCheck
              className="w-7 h-7 text-emerald-600 mb-2"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-800">
              All tickets aligned and low-risk
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Standup updates match ClickUp statuses with zero high-risk items.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 mt-1">
            {attentionTasks.map((task) => {
              const analysis = task.analysis!;
              const riskLabel =
                analysis.risk_level === "high"
                  ? "High risk"
                  : analysis.risk_level === "medium"
                    ? "Med risk"
                    : "Low risk";
              const riskStyle =
                analysis.risk_level === "high"
                  ? "text-red-800 bg-red-50 border-red-200"
                  : analysis.risk_level === "medium"
                    ? "text-amber-800 bg-amber-50 border-amber-200"
                    : "text-emerald-800 bg-emerald-50 border-emerald-200";

              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTaskById(task.id)}
                    className="w-full py-3.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors text-left flex items-start justify-between gap-3 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold border rounded whitespace-nowrap shrink-0 ${riskStyle}`}
                        >
                          {riskLabel}
                        </span>
                        <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                          {task.id}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {task.name}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-1">
                        {analysis.summary}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Owner: {task.assignee}</span>
                        {analysis.drift && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-red-700 font-medium">
                              {formatDriftTypeLabel(analysis.drift_type)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className="w-4 h-4 text-slate-400 group-hover:text-slate-700 mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 7. Blockers Panel */}
      <section
        id="blockers-panel"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Ban
              className="w-4 h-4 text-amber-600 shrink-0"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold text-slate-900">
              Active Blockers
            </h2>
          </div>
          {hasAnalyzed && (
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
              {blockers.length} {blockers.length === 1 ? "blocker" : "blockers"}
            </span>
          )}
        </div>

        {isAnalyzing ? (
          <div className="py-4 space-y-3">
            <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : !hasAnalyzed ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-600 font-medium">
              Waiting for standup analysis
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Blockers mentioned by engineers during standup will appear here
              with their assigned ticket owner.
            </p>
          </div>
        ) : blockers.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-800">
              No active blockers reported
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Zero external dependencies or blockers were detected in the notes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 mt-1">
            {blockers.map((entry, idx) => (
              <li key={`${entry.taskId}-${idx}`}>
                <button
                  type="button"
                  onClick={() => onSelectTaskById(entry.taskId)}
                  className="w-full py-3.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors text-left flex items-start justify-between gap-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {entry.blocker}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                        {entry.taskId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-56">{entry.taskName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-slate-800 block whitespace-nowrap">
                      {entry.owner}
                    </span>
                    <span className="text-[11px] text-slate-500 block whitespace-nowrap">
                      Owner
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
