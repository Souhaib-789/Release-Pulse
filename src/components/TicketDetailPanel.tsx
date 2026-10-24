import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Quote, X } from "lucide-react";
import type { EnrichedTask } from "../types";
import {
  formatDriftTypeLabel,
  formatDueLabel,
} from "../utils/releaseHelpers";

interface TicketDetailPanelProps {
  task: EnrichedTask | null;
  onClose: () => void;
}

export function TicketDetailPanel({ task, onClose }: TicketDetailPanelProps) {
  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [task, onClose]);

  if (!task) return null;

  const isDone = task.normalizedStatus === "Done";
  const dueInfo = formatDueLabel(task.due_date, task.dueInDays, isDone);
  const analysis = task.analysis;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-drawer-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/30 transition-opacity"
        aria-hidden="true"
      />

      {/* Side panel */}
      <aside className="relative z-10 w-full max-w-lg bg-white h-full shadow-xl border-l border-slate-200 flex flex-col overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {task.id}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{task.release}</span>
            </div>
            <h2
              id="ticket-drawer-title"
              className="text-lg font-semibold text-slate-900 mt-1 leading-snug"
            >
              {task.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close ticket details"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
            <span>
              Assignee:{" "}
              <strong className="font-semibold text-slate-900">
                {task.assignee}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className={dueInfo.isUrgent ? "text-amber-700 font-medium" : ""}>
              {dueInfo.text}
            </span>
            {analysis && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Risk:{" "}
                  <strong
                    className={
                      analysis.risk_level === "high"
                        ? "text-red-700 uppercase"
                        : analysis.risk_level === "medium"
                          ? "text-amber-700 uppercase"
                          : "text-emerald-700 uppercase"
                    }
                  >
                    {analysis.risk_level}
                  </strong>
                </span>
              </>
            )}
          </div>

          {/* Side-by-Side Comparison: ClickUp vs Standup */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-700">
                Status Comparison
              </h3>
              {analysis && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${
                    analysis.drift
                      ? "text-red-800 bg-red-50 border-red-200"
                      : "text-emerald-800 bg-emerald-50 border-emerald-200"
                  }`}
                >
                  {analysis.drift ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        Drift: {formatDriftTypeLabel(analysis.drift_type)}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Aligned</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <span className="text-[11px] font-medium text-slate-500 block">
                  ClickUp Status
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {task.status}
                </p>
              </div>

              <div
                className={`border rounded-lg p-3.5 ${
                  analysis?.drift
                    ? "bg-red-50/50 border-red-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className="text-[11px] font-medium text-slate-500 block">
                  Said in Standup
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {analysis
                    ? analysis.mentioned_in_standup
                      ? analysis.spoken_status
                      : "Not mentioned in standup"
                    : "Run Analyze release to compare"}
                </p>
              </div>
            </div>
          </div>

          {!analysis ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
              This ticket has not been compared against standup notes yet. Click{" "}
              <strong className="font-semibold text-slate-900">
                Analyze release
              </strong>{" "}
              on the dashboard to evaluate drift, extract evidence quotes, and
              list blockers.
            </div>
          ) : (
            <>
              {/* Summary */}
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-1.5">
                  Analysis Summary
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {analysis.summary}
                </p>
              </div>

              {/* Evidence Quote */}
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-1.5">
                  Standup Evidence Quote
                </h3>
                {analysis.evidence_quote ? (
                  <blockquote className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-800 italic flex items-start gap-2.5">
                    <Quote
                      className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>"{analysis.evidence_quote}"</span>
                  </blockquote>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    No mention of this ticket was found in the standup notes.
                  </p>
                )}
              </div>

              {/* Blockers */}
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-1.5">
                  Blockers ({analysis.blockers.length})
                </h3>
                {analysis.blockers.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No active blockers identified for this ticket.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {analysis.blockers.map((blocker, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-red-900 bg-red-50/70 border border-red-200 rounded-lg px-3.5 py-2.5"
                      >
                        {blocker}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
