import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getMockTasks } from "./src/mockData.ts";
import type { DriftType, RiskLevel, Task, TaskAnalysis } from "./src/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const CLICKUP_CACHE_TTL_MS = 60_000; // 60-second in-memory cache for ClickUp API

// Shared Google GenAI client used solely to call hosted Gemma models server-side
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resolve the Gemma model ID from GEMMA_MODEL environment variable (never use Gemini models)
function getGemmaModelCandidates(): string[] {
  const envModel = process.env.GEMMA_MODEL?.trim();
  if (
    envModel &&
    envModel !== "[GEMMA MODEL ID]" &&
    envModel !== "MY_GEMMA_MODEL"
  ) {
    return [envModel];
  }
  // Hosted Gemma 4 open-weight models on Google GenAI API
  return ["gemma-4-26b-a4b-it", "gemma-4-31b-it"];
}

// Strip markdown code fences (```json ... ``` or ``` ... ```) from raw model output
function stripMarkdownCodeFences(rawText: string): string {
  let cleaned = rawText.trim();
  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    cleaned = fencedMatch[1].trim();
  } else {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return cleaned;
}

const VALID_DRIFT_TYPES = new Set<DriftType>([
  "none",
  "blocked",
  "stale_status",
  "no_update",
  "scope_change",
]);

const VALID_RISK_LEVELS = new Set<RiskLevel>(["low", "medium", "high"]);

// Validate parsed JSON strictly against the required TaskAnalysis[] schema
function validateAnalysisSchema(
  parsed: unknown,
  expectedTaskIds: string[]
): TaskAnalysis[] {
  if (!Array.isArray(parsed)) {
    throw new Error("Expected Gemma output to be a JSON array.");
  }

  const byId = new Map<string, TaskAnalysis>();

  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new Error("Analysis array element is not an object.");
    }
    const obj = item as Record<string, unknown>;

    if (typeof obj.task_id !== "string" || !obj.task_id.trim()) {
      throw new Error("Invalid or missing task_id.");
    }
    if (typeof obj.mentioned_in_standup !== "boolean") {
      throw new Error(`Invalid mentioned_in_standup for ${obj.task_id}.`);
    }
    if (typeof obj.spoken_status !== "string") {
      throw new Error(`Invalid spoken_status for ${obj.task_id}.`);
    }
    if (typeof obj.drift !== "boolean") {
      throw new Error(`Invalid drift boolean for ${obj.task_id}.`);
    }
    if (
      typeof obj.drift_type !== "string" ||
      !VALID_DRIFT_TYPES.has(obj.drift_type as DriftType)
    ) {
      throw new Error(`Invalid drift_type '${String(obj.drift_type)}' for ${obj.task_id}.`);
    }
    if (
      !Array.isArray(obj.blockers) ||
      !obj.blockers.every((b) => typeof b === "string")
    ) {
      throw new Error(`Invalid blockers array for ${obj.task_id}.`);
    }
    if (
      typeof obj.risk_level !== "string" ||
      !VALID_RISK_LEVELS.has(obj.risk_level as RiskLevel)
    ) {
      throw new Error(`Invalid risk_level '${String(obj.risk_level)}' for ${obj.task_id}.`);
    }
    if (typeof obj.evidence_quote !== "string") {
      throw new Error(`Invalid evidence_quote for ${obj.task_id}.`);
    }
    if (typeof obj.summary !== "string") {
      throw new Error(`Invalid summary for ${obj.task_id}.`);
    }

    byId.set(obj.task_id.trim(), {
      task_id: obj.task_id.trim(),
      mentioned_in_standup: obj.mentioned_in_standup,
      spoken_status: obj.spoken_status.trim(),
      drift: obj.drift,
      drift_type: obj.drift_type as DriftType,
      blockers: obj.blockers.map((b) => b.trim()).filter(Boolean),
      risk_level: obj.risk_level as RiskLevel,
      evidence_quote: obj.evidence_quote.trim(),
      summary: obj.summary.trim(),
    });
  }

  // Ensure every input ticket has a corresponding validated analysis object
  return expectedTaskIds.map((id) => {
    const found = byId.get(id);
    if (!found) {
      throw new Error(`Missing analysis entry for ticket ${id}.`);
    }
    return found;
  });
}

// Validate stakeholder update JSON object { "update": string }
function validateUpdateDraftSchema(parsed: unknown): { update: string } {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object with an 'update' string field.");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.update !== "string" || !obj.update.trim()) {
    throw new Error("Missing or empty 'update' field in Gemma JSON response.");
  }
  return { update: obj.update.trim() };
}

/**
 * GEMMA AI CALL HELPER:
 * - Uses ONLY Gemma models from GEMMA_MODEL env var (never Gemini models).
 * - Places ALL instructions inside the user prompt (no systemInstruction, no native JSON mode).
 * - Asks for JSON only, strips markdown code fences, parses JSON, validates against schema,
 *   and retries once if parsing or validation fails.
 */
async function callGemmaWithValidation<T>(
  userPrompt: string,
  validator: (parsed: unknown) => T
): Promise<{ data: T; modelUsed: string }> {
  const ai = getGenAIClient();
  const candidates = getGemmaModelCandidates();

  let modelUsed = candidates[0];

  const invokeModelOnce = async (promptText: string): Promise<string> => {
    let lastModelErr: unknown;
    for (const candidateModel of candidates) {
      for (let transientTry = 0; transientTry < 2; transientTry++) {
        try {
          const isGemma4 = candidateModel.toLowerCase().includes("gemma-4");
          const response = await ai.models.generateContent({
            model: candidateModel,
            contents: promptText,
            ...(isGemma4
              ? {
                  config: {
                    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                  },
                }
              : {}),
          });
          modelUsed = candidateModel;
          return response.text ?? "";
        } catch (err: unknown) {
          lastModelErr = err;
          const message = err instanceof Error ? err.message : String(err);
          const isTransient =
            message.includes("500") ||
            message.includes("503") ||
            message.includes("429") ||
            message.toLowerCase().includes("unavailable") ||
            message.toLowerCase().includes("internal");

          if (isTransient && transientTry === 0) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          break;
        }
      }
    }
    throw lastModelErr;
  };

  // Attempt 1
  try {
    const rawFirst = await invokeModelOnce(userPrompt);
    const cleanedFirst = stripMarkdownCodeFences(rawFirst);
    const parsedFirst = JSON.parse(cleanedFirst);
    return { data: validator(parsedFirst), modelUsed };
  } catch (firstErr: unknown) {
    const errReason =
      firstErr instanceof Error ? firstErr.message : "Invalid JSON format";
    console.warn(
      `[ReleasePulse] Gemma JSON parse/validation failed on attempt 1 (${errReason}). Retrying once...`
    );

    // Retry once (Attempt 2) with explicit correction instructions in the user prompt
    const retryPrompt = `${userPrompt}

IMPORTANT CORRECTION: Your previous output failed JSON parsing or schema validation (${errReason}). Return ONLY raw, strictly valid JSON matching the exact schema above. Do NOT wrap in markdown code fences and do NOT include any prose before or after the JSON.`;

    const rawSecond = await invokeModelOnce(retryPrompt);
    const cleanedSecond = stripMarkdownCodeFences(rawSecond);
    const parsedSecond = JSON.parse(cleanedSecond);
    return { data: validator(parsedSecond), modelUsed };
  }
}

// In-memory 60-second cache for ClickUp tasks
interface TaskCache {
  tasks: Task[];
  timestamp: number;
}
let clickupCache: TaskCache | null = null;

interface ClickUpApiTask {
  id: string;
  custom_id?: string | null;
  name?: string;
  status?: { status?: string };
  assignees?: Array<{ username?: string; email?: string }>;
  due_date?: string | null;
  tags?: Array<{ name?: string }>;
  list?: { name?: string };
}

function formatStatusLabel(rawStatus: string | undefined): string {
  if (!rawStatus) return "To Do";
  const lower = rawStatus.trim().toLowerCase();
  if (lower === "to do" || lower === "todo" || lower === "open" || lower === "backlog") {
    return "To Do";
  }
  if (lower === "in progress" || lower === "doing" || lower === "active") {
    return "In Progress";
  }
  if (lower === "in review" || lower === "review" || lower === "code review") {
    return "In Review";
  }
  if (lower === "qa" || lower === "ready for qa" || lower === "testing") {
    return rawStatus.trim().toLowerCase() === "ready for qa" ? "Ready for QA" : "QA";
  }
  if (
    lower === "done" ||
    lower === "complete" ||
    lower === "completed" ||
    lower === "closed" ||
    lower === "released"
  ) {
    return lower === "released" ? "Released" : "Done";
  }
  return rawStatus.trim();
}

/**
 * CLICKUP API CALL HELPER:
 * Calls GET https://api.clickup.com/api/v2/list/{list_id}/task
 * using header "Authorization: <raw token>" (NOT Bearer).
 * Caches results in memory for 60 seconds.
 */
async function fetchClickUpTasksWithCache(): Promise<{
  tasks: Task[];
  isMock: boolean;
  fromCache: boolean;
}> {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  const listIdsRaw = process.env.CLICKUP_LIST_IDS?.trim();

  if (!token || !listIdsRaw) {
    return { tasks: getMockTasks(), isMock: true, fromCache: false };
  }

  const listIds = listIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (listIds.length === 0) {
    return { tasks: getMockTasks(), isMock: true, fromCache: false };
  }

  // Serve from 60-second in-memory cache if fresh
  if (clickupCache && Date.now() - clickupCache.timestamp < CLICKUP_CACHE_TTL_MS) {
    return { tasks: clickupCache.tasks, isMock: false, fromCache: true };
  }

  try {
    const allTasks: Task[] = [];

    for (const listId of listIds) {
      const response = await fetch(
        `https://api.clickup.com/api/v2/list/${encodeURIComponent(listId)}/task?include_closed=true`,
        {
          method: "GET",
          headers: {
            // ClickUp v2 personal token requires raw token in Authorization header (NOT Bearer)
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `ClickUp API returned HTTP ${response.status} for list ${listId}`
        );
      }

      const payload = (await response.json()) as { tasks?: ClickUpApiTask[] };
      const rawTasks = Array.isArray(payload.tasks) ? payload.tasks : [];

      for (const t of rawTasks) {
        const releaseTag = t.tags?.find(
          (tag) => tag.name && /release|^v\d/i.test(tag.name)
        )?.name;
        const releaseName =
          releaseTag ||
          t.list?.name ||
          t.tags?.[0]?.name ||
          `List ${listId}`;

        const dueIso = t.due_date
          ? new Date(Number(t.due_date)).toISOString().split("T")[0]
          : null;

        allTasks.push({
          id: t.custom_id || t.id,
          name: t.name || "Untitled Ticket",
          status: formatStatusLabel(t.status?.status),
          assignee:
            t.assignees?.[0]?.username ||
            t.assignees?.[0]?.email ||
            "Unassigned",
          due_date: dueIso,
          release: releaseName,
        });
      }
    }

    clickupCache = {
      tasks: allTasks,
      timestamp: Date.now(),
    };

    return { tasks: allTasks, isMock: false, fromCache: false };
  } catch (err: unknown) {
    console.warn(
      "[ReleasePulse] ClickUp request failed, falling back to mock demo data:",
      err instanceof Error ? err.message : err
    );
    return { tasks: getMockTasks(), isMock: true, fromCache: false };
  }
}

function computeDaysUntil(dueDateStr: string | null): number | null {
  if (!dueDateStr) return null;
  const target = new Date(`${dueDateStr}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function extractGoogleDocId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const docUrlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docUrlMatch && docUrlMatch[1]) {
    return docUrlMatch[1];
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // 1. GET /api/tasks
  app.get("/api/tasks", async (_req, res) => {
    try {
      const { tasks, isMock, fromCache } = await fetchClickUpTasksWithCache();
      res.setHeader("X-Mock-Mode", isMock ? "true" : "false");
      res.setHeader("X-Cache", fromCache ? "HIT" : "MISS");
      res.json(tasks);
    } catch (err: unknown) {
      res.setHeader("X-Mock-Mode", "true");
      res.json(getMockTasks());
    }
  });

  // 2. POST /api/analyze
  app.post("/api/analyze", async (req, res) => {
    try {
      const { tasks, notes } = req.body as {
        tasks?: Task[];
        notes?: string;
      };

      if (!Array.isArray(tasks) || tasks.length === 0) {
        res.status(400).json({ error: "Please provide a non-empty array of tasks to analyze." });
        return;
      }

      if (typeof notes !== "string" || !notes.trim()) {
        res.status(400).json({ error: "Please enter or load standup notes before running analysis." });
        return;
      }

      const formattedTickets = tasks.map((t) => {
        const dueDays = computeDaysUntil(t.due_date);
        const dueDesc =
          dueDays === null
            ? "No due date"
            : dueDays < 0
              ? `${t.due_date} (${Math.abs(dueDays)} day(s) ago / past due)`
              : dueDays === 0
                ? `${t.due_date} (due today, 0 days)`
                : `${t.due_date} (due in ${dueDays} day(s))`;
        return {
          id: t.id,
          name: t.name,
          clickup_status: t.status,
          assignee: t.assignee,
          due_date: dueDesc,
          due_in_days: dueDays,
          release: t.release,
        };
      });

      // Single user prompt containing all instructions (no systemInstruction, no native JSON mode)
      const analysisUserPrompt = `You are analyzing release health for a Product Manager. Compare the official ClickUp ticket list against what the engineering team actually said in today's standup notes.

INSTRUCTIONS:
1. Match each standup update to a ticket by ticket ID or by ticket name/topic (and assignee context when helpful).
2. Return a JSON array with EXACTLY ONE object for EVERY ticket in the ClickUp list below (preserve all ${tasks.length} task_id values).
3. Judge "drift" as true when what was said in standup contradicts or materially differs from the ClickUp status:
   - Examples of drift=true:
     * ClickUp says "In Progress" or "To Do", but standup says the work is blocked, on hold, waiting on keys/assets/copy/templates, or at risk of slipping ("drift_type": "blocked").
     * ClickUp says "In Progress", but standup says coding is already done/merged and waiting on QA or review ("drift_type": "stale_status").
     * ClickUp says "To Do" or "In Progress" and the ticket was NOT mentioned in standup at all ("drift_type": "no_update", set "drift": true unless ClickUp status is already "Done" or "Released").
     * Standup describes scope expansion, descoping, or changing requirements ("drift_type": "scope_change").
   - When standup aligns with ClickUp status and has no material blocker (for example ClickUp says "In Review" and standup says "in review / ready for review", or ClickUp says "Done" and standup says "shipped yesterday"), set "drift": false and "drift_type": "none".
4. Use "drift_type": "no_update" and "mentioned_in_standup": false when a ticket was not mentioned at all in the notes. Raise "risk_level" to "high" if an unmentioned active ticket is due within 3 days (due_in_days <= 3 and status is not Done/Released).
5. Also set "risk_level" to "high" when a ticket is blocked and due within 3 days, or has a severe release-threatening blocker; "medium" when blocked with >3 days buffer, on hold, minor test flakiness, or stale status near deadline; "low" when on track or already Done.
6. Quote the EXACT short phrase verbatim from the standup notes as "evidence_quote". If the ticket was not mentioned in the notes, set "evidence_quote" to "". NEVER invent information not present in the notes.
7. List concrete blockers in "blockers" (array of short strings, or [] if none).
8. Write a crisp one-line explanation in "summary" (under 140 characters) explaining the status comparison or risk.
9. Return ONLY a valid JSON array and NO other text, NO markdown fences, NO commentary.

REQUIRED OUTPUT SCHEMA (JSON array, one object per ticket):
[
  {
    "task_id": "string (exact id from ticket list)",
    "mentioned_in_standup": true,
    "spoken_status": "string (short summary of what was said, or 'Not mentioned in standup')",
    "drift": true,
    "drift_type": "none" | "blocked" | "stale_status" | "no_update" | "scope_change",
    "blockers": ["string"],
    "risk_level": "low" | "medium" | "high",
    "evidence_quote": "exact verbatim quote from standup notes, or empty string if not mentioned",
    "summary": "short one-line reason/summary"
  }
]

CLICKUP TICKETS:
${JSON.stringify(formattedTickets, null, 2)}

TEAM STANDUP NOTES:
"""
${notes.trim()}
"""

Return ONLY the JSON array now:`;

      const expectedIds = tasks.map((t) => t.id);
      const { data, modelUsed } = await callGemmaWithValidation(
        analysisUserPrompt,
        (parsed) => validateAnalysisSchema(parsed, expectedIds)
      );

      res.setHeader("X-Gemma-Model", modelUsed);
      res.json(data);
    } catch (err: unknown) {
      console.error("[ReleasePulse] /api/analyze error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to analyze standup notes with Gemma.";
      res.status(500).json({ error: message });
    }
  });

  // 3. POST /api/notes/fetch
  app.post("/api/notes/fetch", async (req, res) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url || typeof url !== "string" || !url.trim()) {
        res.status(400).json({
          error: "Please enter a Google Doc link first, or paste the standup notes directly.",
        });
        return;
      }

      const docId = extractGoogleDocId(url);
      if (!docId) {
        res.status(400).json({
          error:
            "Could not find a valid Google Doc ID in that link. Please check the URL or paste your standup notes directly below.",
        });
        return;
      }

      const exportUrl = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`;
      const docRes = await fetch(exportUrl, {
        method: "GET",
        redirect: "follow",
      });

      const contentType = docRes.headers.get("content-type") || "";
      if (!docRes.ok || contentType.includes("text/html")) {
        res.status(422).json({
          error:
            'Could not fetch that Google Doc. Make sure sharing is set to "Anyone with the link", or paste your standup notes directly into the editor.',
        });
        return;
      }

      const plainText = (await docRes.text()).replace(/^\uFEFF/, "").trim();
      if (!plainText) {
        res.status(422).json({
          error:
            "That Google Doc appears to be empty. Please paste your standup notes directly instead.",
        });
        return;
      }

      res.json({ text: plainText });
    } catch (_err: unknown) {
      res.status(422).json({
        error:
          'Unable to load that Google Doc link. It works only for docs shared as "Anyone with the link" — please paste your standup notes instead.',
      });
    }
  });

  // 4. POST /api/update-draft
  app.post("/api/update-draft", async (req, res) => {
    try {
      const { analysis, release } = req.body as {
        analysis?: unknown;
        release?: string;
      };

      if (!analysis || (Array.isArray(analysis) && analysis.length === 0)) {
        res.status(400).json({
          error: "Run release analysis first so there is analysis data to summarize.",
        });
        return;
      }

      const releaseTitle =
        typeof release === "string" && release.trim()
          ? release.trim()
          : "All Active Releases";

      // Single user prompt asking Gemma for JSON only (consistent with Gemma JSON-only + fence-strip + retry pipeline)
      const draftUserPrompt = `You are drafting a stakeholder release update for a Product Manager based on the verified ticket analysis below.

TARGET RELEASE: ${releaseTitle}

INSTRUCTIONS:
1. Write a concise stakeholder status update that is 5 to 8 lines long in plain, clear English.
2. Put RISKS, BLOCKERS, and STATUS DRIFT FIRST (name specific tickets/areas, owners, and what is blocking them).
3. Follow with progress highlights (what shipped, what is in review/QA, and overall momentum) and immediate next actions needed from stakeholders/vendors/product/design.
4. Do NOT invent any facts, dates, or metrics not present in the analysis data.
5. Separate the 5-8 lines with newline characters ("\\n"). Keep tone direct, executive-friendly, and free of hype.
6. Return ONLY a valid JSON object matching this exact schema (no markdown code fences, no extra text):
{
  "update": "string containing the 5-8 line plain-English stakeholder status update"
}

ANALYSIS DATA:
${JSON.stringify(analysis, null, 2)}

Return ONLY the JSON object now:`;

      const { data, modelUsed } = await callGemmaWithValidation(
        draftUserPrompt,
        validateUpdateDraftSchema
      );

      res.setHeader("X-Gemma-Model", modelUsed);
      res.json({ text: data.update });
    } catch (err: unknown) {
      console.error("[ReleasePulse] /api/update-draft error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to draft stakeholder update with Gemma.";
      res.status(500).json({ error: message });
    }
  });

  // Mount Vite dev server in development or static dist in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ReleasePulse] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
