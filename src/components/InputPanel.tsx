import { useState } from "react";
import { FileText, Loader2, Play, RotateCcw } from "lucide-react";
import { MOCK_STANDUP_NOTES } from "../mockData";

interface InputPanelProps {
  notes: string;
  onNotesChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  ticketCount: number;
  hasAnalyzed: boolean;
  analyzeError: string | null;
}

export function InputPanel({
  notes,
  onNotesChange,
  onAnalyze,
  isAnalyzing,
  ticketCount,
  hasAnalyzed,
  analyzeError,
}: InputPanelProps) {
  const [docUrl, setDocUrl] = useState("");
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const handleLoadGoogleDoc = async () => {
    if (!docUrl.trim()) {
      setDocFeedback({
        type: "error",
        message: "Paste a shared Google Doc link first.",
      });
      return;
    }

    setIsLoadingDoc(true);
    setDocFeedback(null);

    try {
      const res = await fetch("/api/notes/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: docUrl.trim() }),
      });

      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        setDocFeedback({
          type: "error",
          message:
            data.error ||
            'Could not load that Google Doc. Ensure it is shared as "Anyone with the link" or paste the notes directly.',
        });
        return;
      }

      onNotesChange(data.text);
      setDocFeedback({
        type: "success",
        message: "Loaded standup notes from Google Doc.",
      });
    } catch {
      setDocFeedback({
        type: "error",
        message:
          "Network error while fetching the Google Doc. Please paste your standup notes directly instead.",
      });
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const isModifiedFromDemo = notes.trim() !== MOCK_STANDUP_NOTES.trim();

  return (
    <section
      id="standup-input"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Standup Notes vs. ClickUp Status
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Compare spoken team updates against{" "}
                <span className="font-mono font-medium text-slate-800 tabular-nums">
                  {ticketCount}
                </span>{" "}
                tracked ClickUp tickets to surface hidden blockers and stale
                statuses.
              </p>
            </div>

            {isModifiedFromDemo && (
              <button
                type="button"
                onClick={() => {
                  onNotesChange(MOCK_STANDUP_NOTES);
                  setDocFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Restore demo notes</span>
              </button>
            )}
          </div>

          <label htmlFor="standup-notes-textarea" className="sr-only">
            Standup notes
          </label>
          <textarea
            id="standup-notes-textarea"
            rows={5}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Paste daily standup transcript or speaker-by-speaker notes here..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3.5 py-3 text-sm text-slate-900 leading-relaxed placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors resize-y"
          />
        </div>

        {/* Right column: Google Doc importer + Primary Analyze CTA */}
        <div className="w-full lg:w-88 shrink-0 flex flex-col justify-between gap-4 lg:pt-7">
          <div>
            <label
              htmlFor="google-doc-url"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Import from Google Docs (shared with link)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <FileText
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="google-doc-url"
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLoadGoogleDoc();
                    }
                  }}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <button
                type="button"
                onClick={handleLoadGoogleDoc}
                disabled={isLoadingDoc}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200/70 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isLoadingDoc && (
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>{isLoadingDoc ? "Loading..." : "Load notes"}</span>
              </button>
            </div>

            {docFeedback && (
              <p
                role={docFeedback.type === "error" ? "alert" : "status"}
                className={`mt-2 text-xs leading-snug ${
                  docFeedback.type === "error"
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {docFeedback.message}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing || !notes.trim() || ticketCount === 0}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-55 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Analyzing standup drift with Gemma...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>
                    {hasAnalyzed ? "Re-analyze release" : "Analyze release"}
                  </span>
                </>
              )}
            </button>

            {analyzeError && (
              <p
                role="alert"
                className="mt-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {analyzeError}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
