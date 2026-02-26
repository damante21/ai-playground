# AI Engineering Local Setup

Step-by-step guide to run the AI Engineering project locally in a standalone-friendly way. Keep this file updated as implementation changes.

Companion file: `AI_ENGINEERING_PROJECT_REQUIREMENTS.md`

---

## 1) Clone and Install

If using the public repo directly:

```bash
git clone git@github.com:damante21/ai-playground.git
cd ai-playground
npm install
```

If using from private monorepo subtree path:

```bash
cd /path/to/jamesdamante.com/apps/ai-engineering
npm install
```

---

## 2) Create Environment File

Create `.env` in the runtime server context and set all required values:

```bash
AI_ENGINEERING_SECRET_KEY=change-me

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...

LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=safespace-events

LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

DATABASE_URL=postgresql://user:password@localhost:5432/ai_engineering
```

Never commit this file.

---

## 3) Start PostgreSQL + Enable pgvector

Run PostgreSQL and ensure `pgvector` is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then apply/create schema for:
- `ai_engineering_venues`
- LangGraph checkpoint/store tables (via `PostgresSaver.setup()` / `PostgresStore.setup()`)

---

## 4) Build/Serve Modes

There are two primary local modes.

### Mode A: Full app through main Node server (closest to production)

1. Build Vite frontend:

```bash
cd apps/ai-engineering
npm run build
```

2. Start main backend server (from repo root/server workspace, depending on project scripts)
3. Open:
   - UI: `http://localhost:<PORT>/ai-engineering`
   - API: `http://localhost:<PORT>/api/ai-engineering/*`

### Mode B: Frontend dev + backend API

1. Start backend API server
2. Start Vite dev server:

```bash
cd apps/ai-engineering
npm run dev
```

3. Ensure Vite proxy forwards `/api/ai-engineering` to backend.

---

## 5) Validate Critical Runtime Features

### Access Gate

1. Open `/ai-engineering`
2. Enter wrong secret key -> must reject
3. Enter correct secret key -> must issue access token/session
4. Verify API requests are blocked without token and allowed with token

### RAG Pipeline

1. Ingest venue data into `ai_engineering_venues`
2. Run a query and verify:
   - Tavily returns raw event candidates
   - retriever returns venue context
   - filter uses both to produce final results

### Memory

1. Start search thread and ask follow-up refinement question
2. Verify short-term memory via same `thread_id`
3. Save preferences and start new session
4. Verify long-term memory loads saved preferences

### Evaluation

1. Generate/load golden dataset
2. Run baseline (`naive`) evaluation
3. Run comparison (`bm25`, `multiQuery`, `hybrid`)
4. Confirm Langfuse shows all 4 metrics:
   - faithfulness
   - response relevance
   - context precision
   - context recall
5. Capture screenshot(s) and experiment/export IDs

---

## 6) Required Commands (Expected)

These scripts should exist (or equivalent):

```bash
# install
npm install

# frontend dev
npm run dev

# frontend build
npm run build

# eval baseline
npm run eval:baseline

# eval compare retrievers
npm run eval:compare
```

If script names differ, keep this file updated with the real commands.

---

## 7) Troubleshooting

### Blank page / broken assets on `/ai-engineering`

- Verify `vite.config.ts` has:

```ts
base: "/ai-engineering/"
```

- Rebuild frontend and restart backend static serving.

### No memory between follow-up queries

- Confirm `thread_id` is passed in graph invoke config.
- Confirm `PostgresSaver` initialized with `setup()`.

### Long-term prefs not loading

- Confirm `PostgresStore` initialized with `setup()`.
- Confirm namespace/key usage is consistent:
  - `[session_key, "preferences"]` / `saved_filters`

### No eval scores in Langfuse

- Confirm evaluator library configured in Langfuse dashboard.
- Confirm traces match evaluator filters.
- Confirm dataset items are linked to traces/runs.

---

## 8) Done Criteria (Local)

Local setup is considered complete when:

- app loads at `/ai-engineering`
- secret-key auth gate works
- search returns categorized results
- memory works:
  - in-thread follow-up context
  - cross-session saved preferences
- eval pipeline runs and outputs the 4 rubric metrics
- evidence artifacts collected for `DELIVERABLES.md`

