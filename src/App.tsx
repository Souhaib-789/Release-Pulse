import { useCallback, useEffect, useMemo, useState } from "react";
import { AttentionAndBlockers } from "./components/AttentionAndBlockers";
import { Header } from "./components/Header";
import { InputPanel } from "./components/InputPanel";
import { KanbanBoard } from "./components/KanbanBoard";
import { ReleaseSummaryCards } from "./components/ReleaseSummaryCards";
import { StakeholderModal } from "./components/StakeholderModal";
import { TicketDetailPanel } from "./components/TicketDetailPanel";
import { MOCK_STANDUP_NOTES } from "./mockData";
import type { Task, TaskAnalysis } from "./types";
import { enrichTasks } from "./utils/releaseHelpers";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [notes, setNotes] = useState<string>(MOCK_STANDUP_NOTES);
  const [analysisList, setAnalysisList] = useState<TaskAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [selectedRelease, setSelectedRelease] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [stakeholderModalState, setStakeholderModalState] = useState<{
    open: boolean;
    release?: string;
  }>({ open: false });

  const loadTasks = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingTasks(true);
    }
    setTasksError(null);

    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks (HTTP ${res.status})`);
      }
      const mockHeader = res.headers.get("X-Mock-Mode") === "true";
      const data = (await res.json()) as Task[];
      setTasks(Array.isArray(data) ? data : []);
      setIsMockMode(mockHeader);
    } catch (err: unknown) {
      setTasksError(
        err instanceof Error ? err.message : "Unable to load release tasks."
      );
    } finally {
      setIsLoadingTasks(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(false);
  }, [loadTasks]);

  const handleAnalyzeRelease = async () => {
    if (!tasks.length || !notes.trim()) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks,
          notes: notes.trim(),
        }),
      });

      const payload = (await res.json()) as TaskAnalysis[] | { error?: string };
      if (!res.ok || !Array.isArray(payload)) {
        const message =
          !Array.isArray(payload) && payload?.error
            ? payload.error
            : "Analysis failed. Please verify GEMMA_MODEL / GEMINI_API_KEY configuration.";
        throw new Error(message);
      }

      setAnalysisList(payload);
    } catch (err: unknown) {
      setAnalyzeError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during Gemma analysis."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analysisMap = useMemo(() => {
    const map = new Map<string, TaskAnalysis>();
    for (const item of analysisList) {
      map.set(item.task_id, item);
    }
    return map;
  }, [analysisList]);

  const allEnrichedTasks = useMemo(
    () => enrichTasks(tasks, analysisMap),
    [tasks, analysisMap]
  );

  const visibleTasks = useMemo(() => {
    if (selectedRelease === "all") return allEnrichedTasks;
    return allEnrichedTasks.filter((t) => t.release === selectedRelease);
  }, [allEnrichedTasks, selectedRelease]);

  const selectedTask = useMemo(
    () => allEnrichedTasks.find((t) => t.id === selectedTaskId) || null,
    [allEnrichedTasks, selectedTaskId]
  );

  const hasAnalyzed = analysisList.length > 0;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        isMockMode={isMockMode}
        isRefreshing={isRefreshing}
        onRefresh={() => loadTasks(true)}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {tasksError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-4"
          >
            <span>{tasksError}</span>
            <button
              type="button"
              onClick={() => loadTasks(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-300 rounded-lg hover:bg-red-50 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 2. Standup Notes & Google Doc Input Panel */}
        <InputPanel
          notes={notes}
          onNotesChange={setNotes}
          onAnalyze={handleAnalyzeRelease}
          isAnalyzing={isAnalyzing}
          ticketCount={tasks.length}
          hasAnalyzed={hasAnalyzed}
          analyzeError={analyzeError}
        />

        {/* 3. Release Summary Cards */}
        <ReleaseSummaryCards
          tasks={allEnrichedTasks}
          selectedRelease={selectedRelease}
          onSelectRelease={setSelectedRelease}
          hasAnalyzed={hasAnalyzed}
          onOpenStakeholderModal={(release) =>
            setStakeholderModalState({ open: true, release })
          }
        />

        {/* 4. Release Pipeline Kanban Board */}
        <KanbanBoard
          tasks={visibleTasks}
          isLoadingTasks={isLoadingTasks}
          isAnalyzing={isAnalyzing}
          selectedTaskId={selectedTaskId}
          onSelectTask={(task) => setSelectedTaskId(task.id)}
        />

        {/* 6 & 7. Needs Attention & Active Blockers Panels */}
        <AttentionAndBlockers
          tasks={visibleTasks}
          hasAnalyzed={hasAnalyzed}
          isAnalyzing={isAnalyzing}
          onSelectTaskById={(id) => setSelectedTaskId(id)}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>ReleasePulse · Release Status &amp; Standup Drift Dashboard</span>
          <span>ClickUp responses cached server-side for 60s</span>
        </div>
      </footer>

      {/* 5. Side Panel for Ticket Comparison */}
      <TicketDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* 8. Stakeholder Update Generator Modal */}
      <StakeholderModal
        isOpen={stakeholderModalState.open}
        initialRelease={stakeholderModalState.release}
        tasks={allEnrichedTasks}
        onClose={() => setStakeholderModalState({ open: false })}
      />
    </div>
  );
}
