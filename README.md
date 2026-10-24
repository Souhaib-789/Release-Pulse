# ReleasePulse

**ReleasePulse** is a full-stack release-status dashboard for Product Managers that compares official ClickUp ticket statuses against what engineers actually reported in daily standup notes, flagging **status drift**, hidden blockers, and schedule risks.

---

## Features

- **Server-Side ClickUp Sync + 60s Cache**: Fetches tasks from ClickUp Lists (`GET https://api.clickup.com/api/v2/list/{list_id}/task`) on the server so API tokens never reach the browser, with a 60-second in-memory cache.
- **Automatic Demo / Mock Mode**: Falls back seamlessly to realistic multi-release mock tickets and standup notes (`Release 2.4 - Payments Revamp` and `Release 2.5 - Onboarding`) whenever `CLICKUP_API_TOKEN` is omitted or unreachable, displaying a `Demo data` badge in the header.
- **Gemma Status-Drift Analysis**: Calls a hosted **Gemma** model (`GEMMA_MODEL`) using prompt-only JSON instructions, strips markdown fences, validates every field against the strict schema, and retries once automatically if parsing or validation fails.
- **Google Docs Standup Import**: Extracts the document ID from shared Google Doc links and fetches plain-text exports server-side.
- **Kanban Pipeline, Attention & Blockers Views**: Visualizes tickets across `To Do`, `In Progress`, `In Review`, `QA`, and `Done` with side-by-side ClickUp vs. standup inspection drawers and one-click stakeholder status update drafts.

---

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key used by `@google/genai` on the server to call Gemma models. |
| `GEMMA_MODEL` | Recommended | Hosted Gemma model ID for all AI calls (defaults to `gemma-4-26b-a4b-it`, fallback `gemma-4-31b-it`). Do **not** set Gemini models. |
| `CLICKUP_API_TOKEN` | Optional | Personal ClickUp API token (`pk_...`), sent as a raw `Authorization: <token>` header. Leave blank for Demo Mode. |
| `CLICKUP_LIST_IDS` | Optional | Comma-separated ClickUp List IDs (e.g. `901200101,901200102`). Leave blank for Demo Mode. |
| `APP_URL` | Optional | Base application URL (defaults to `http://localhost:3000`). |

---

## Running Locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `GEMINI_API_KEY` and `GEMMA_MODEL` (e.g. `GEMMA_MODEL="gemma-4-31b-it"`). Optionally add `CLICKUP_API_TOKEN` and `CLICKUP_LIST_IDS` to connect live ClickUp lists.

3. **Start the full-stack development server (port 3000)**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser and click **Analyze release** to run the status-drift detection flow.

4. **Production build & start**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

---

## Backend Endpoints

- `GET /api/tasks` — Returns simplified ClickUp or mock tasks (`{ id, name, status, assignee, due_date, release }`) with `X-Mock-Mode` and `X-Cache` headers.
- `POST /api/notes/fetch` — Accepts `{ url }` for a link-shared Google Doc and returns `{ text }`.
- `POST /api/analyze` — Accepts `{ tasks, notes }` and returns the validated Gemma drift analysis JSON array.
- `POST /api/update-draft` — Accepts `{ analysis, release }` and returns `{ text }` with a 5–8 line risks-first stakeholder status update.
