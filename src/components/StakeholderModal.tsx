import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, X } from "lucide-react";
import type { EnrichedTask } from "../types";

interface StakeholderModalProps {
  isOpen: boolean;
  initialRelease?: string;
  tasks: EnrichedTask[];
  onClose: () => void;
}

export function StakeholderModal({
  isOpen,
  initialRelease,
  tasks,
  onClose,
}: StakeholderModalProps) {
  const releaseNames = Array.from(new Set(tasks.map((t) => t.release)));
  const [targetRelease, setTargetRelease] = useState<string>(
    initialRelease || "All Releases"
  );
  const [draftText, setDraftText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetRelease(initialRelease || "All Releases");
      setCopied(false);
    }
  }, [isOpen, initialRelease]);

  const generateDraft = useCallback(
    async (releaseChoice: string) => {
      setIsLoading(true);
      setError(null);
      setCopied(false);

      const scopedTasks =
        releaseChoice === "All Releases"
          ? tasks
          : tasks.filter((t) => t.release === releaseChoice);

      const analysisPayload = scopedTasks.map((t) => ({
        task_id: t.id,
        ticket_name: t.name,
        release: t.release,
        assignee: t.assignee,
        clickup_status: t.status,
        due_date: t.due_date,
        ...(t.analysis || {}),
      }));

      try {
        const res = await fetch("/api/update-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis: analysisPayload,
            release: releaseChoice,
          }),
        });

        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !data.text) {
          throw new Error(
            data.error || "Failed to generate stakeholder update."
          );
        }

        setDraftText(data.text);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not generate stakeholder update."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [tasks]
  );

  useEffect(() => {
    if (!isOpen) return;
    generateDraft(targetRelease);
  }, [isOpen, targetRelease, generateDraft]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!draftText) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback selection copy
      const textarea = document.createElement("textarea");
      textarea.value = draftText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stakeholder-modal-title"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="stakeholder-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Stakeholder Status Update
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Plain-English executive summary (5–8 lines, risks and blockers
              first)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {releaseNames.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="stakeholder-release-select"
                className="text-xs font-medium text-slate-700"
              >
                Scope:
              </label>
              <select
                id="stakeholder-release-select"
                value={targetRelease}
                onChange={(e) => setTargetRelease(e.target.value)}
                disabled={isLoading}
                className="text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:border-blue-600 focus:outline-none"
              >
                <option value="All Releases">All Active Releases</option>
                {releaseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isLoading ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
                <Loader2
                  className="w-4 h-4 animate-spin text-blue-700"
                  aria-hidden="true"
                />
                <span>Drafting stakeholder update with Gemma...</span>
              </div>
              <div className="h-3.5 bg-slate-200 rounded w-11/12 animate-pulse" />
              <div className="h-3.5 bg-slate-200 rounded w-full animate-pulse" />
              <div className="h-3.5 bg-slate-200 rounded w-10/12 animate-pulse" />
              <div className="h-3.5 bg-slate-200 rounded w-9/12 animate-pulse" />
              <div className="h-3.5 bg-slate-200 rounded w-4/5 animate-pulse" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-xs text-red-800">{error}</p>
              <button
                type="button"
                onClick={() => generateDraft(targetRelease)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-800 bg-white border border-red-300 rounded-md hover:bg-red-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Try again</span>
              </button>
            </div>
          ) : (
            <textarea
              aria-label="Generated stakeholder update text"
              rows={8}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-900 leading-relaxed focus:bg-white focus:border-blue-600 focus:outline-none resize-y"
            />
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => generateDraft(targetRelease)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Regenerate</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={isLoading || !draftText}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy update</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
