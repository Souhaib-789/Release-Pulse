import { AlertTriangle, FileSpreadsheet, GitCompareArrows } from "lucide-react";
import type { EnrichedTask } from "../types";
import { isProgressCompleteStatus } from "../utils/releaseHelpers";

interface ReleaseSummaryCardsProps {
  tasks: EnrichedTask[];
  selectedRelease: string;
  onSelectRelease: (release: string) => void;
  hasAnalyzed: boolean;
  onOpenStakeholderModal: (release?: string) => void;
}

interface ReleaseStats {
  name: string;
  total: number;
  completedOrQa: number;
  progressPct: number;
  highRiskCount: number;
  driftCount: number;
}

export function ReleaseSummaryCards({
  tasks,
  selectedRelease,
  onSelectRelease,
  hasAnalyzed,
  onOpenStakeholderModal,
}: ReleaseSummaryCardsProps) {
  const releaseNames = Array.from(new Set(tasks.map((t) => t.release)));

  const statsList: ReleaseStats[] = releaseNames.map((name) => {
    const releaseTasks = tasks.filter((t) => t.release === name);
    const total = releaseTasks.length;
    const completedOrQa = releaseTasks.filter((t) =>
      isProgressCompleteStatus(t.status)
    ).length;
    const progressPct = total > 0 ? Math.round((completedOrQa / total) * 100) : 0;

    const highRiskCount = releaseTasks.filter(
      (t) => t.analysis?.risk_level === "high"
    ).length;
    const driftCount = releaseTasks.filter(
      (t) => t.analysis?.drift === true
    ).length;

    return {
      name,
      total,
      completedOrQa,
      progressPct,
      highRiskCount,
      driftCount,
    };
  });

  return (
    <section id="release-summary" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            Release Summary
          </h2>
          {releaseNames.length > 1 && (
            <div
              role="group"
              aria-label="Filter by release"
              className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
            >
              <button
                type="button"
                onClick={() => onSelectRelease("all")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedRelease === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All releases ({tasks.length})
              </button>
              {releaseNames.map((rName) => (
                <button
                  key={rName}
                  type="button"
                  onClick={() => onSelectRelease(rName)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 max-w-52 truncate ${
                    selectedRelease === rName
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {rName}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            onOpenStakeholderModal(
              selectedRelease === "all" ? undefined : selectedRelease
            )
          }
          disabled={!hasAnalyzed}
          title={
            hasAnalyzed
              ? "Draft a 5-8 line stakeholder status update"
              : "Run Analyze release first to enable stakeholder updates"
          }
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <span>Generate stakeholder update</span>
        </button>
      </div>

      {statsList.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
          No active releases found. Click Refresh to reload ClickUp tasks.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statsList.map((stat) => {
            const isSelected = selectedRelease === stat.name;
            return (
              <div
                key={stat.name}
                onClick={() =>
                  onSelectRelease(isSelected ? "all" : stat.name)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRelease(isSelected ? "all" : stat.name);
                  }
                }}
                className={`bg-white rounded-xl p-5 border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isSelected
                    ? "border-blue-600 ring-1 ring-blue-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {stat.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {stat.completedOrQa} of {stat.total} tickets in QA / Done / Released
                    </p>
                  </div>
                  <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums shrink-0">
                    {stat.progressPct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="mt-3.5 h-2 w-full bg-slate-100 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={stat.progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${stat.name} completion progress`}
                >
                  <div
                    className="h-full bg-blue-700 rounded-full transition-opacity duration-150"
                    style={{ width: `${stat.progressPct}%` }}
                  />
                </div>

                {/* Metrics footer */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 ${
                          hasAnalyzed && stat.highRiskCount > 0
                            ? "text-red-600"
                            : "text-slate-400"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-slate-600">High-risk tickets:</span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          hasAnalyzed && stat.highRiskCount > 0
                            ? "text-red-700"
                            : "text-slate-900"
                        }`}
                      >
                        {hasAnalyzed ? stat.highRiskCount : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <GitCompareArrows
                        className={`w-3.5 h-3.5 ${
                          hasAnalyzed && stat.driftCount > 0
                            ? "text-amber-600"
                            : "text-slate-400"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-slate-600">Drift warnings:</span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          hasAnalyzed && stat.driftCount > 0
                            ? "text-red-700"
                            : "text-slate-900"
                        }`}
                      >
                        {hasAnalyzed ? stat.driftCount : "—"}
                      </span>
                    </div>
                  </div>

                  {hasAnalyzed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStakeholderModal(stat.name);
                      }}
                      className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Draft update
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
