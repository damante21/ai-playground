# AI Engineering Project Requirements

Canonical requirements for the standalone `ai-playground` project (public subtree target). Keep this file updated as implementation changes.

---

## Purpose

This document defines:
- required runtime/tooling versions
- required packages
- required environment variables
- required services and infrastructure
- required local data/schema for running the project

Use this with `AI_ENGINEERING_LOCAL_SETUP.md`.

---

## Repository Target

- Public repo: `https://github.com/damante21/ai-playground.git`
- Host integration path (private/internal): `<PRIVATE_HOST_INTEGRATION_PATH_PLACEHOLDER>`
  - This project can be embedded into a larger private host application, but those host-specific paths are intentionally not documented in this public subtree.
  - Only public/subtree-safe paths and files are referenced in this repository.

---

## Runtime Requirements

| Component | Required |
|---|---|
| Node.js | `>= 20.x` |
| npm | `>= 10.x` |
| PostgreSQL | `>= 15` (with `pgvector` extension) |
| Docker (optional, recommended) | latest stable |
| Git | latest stable |

---

## Required Services

| Service | Purpose | Required For |
|---|---|---|
| OpenAI | embeddings + worker LLM tasks | app runtime |
| Anthropic | supervisor/complex reasoning | app runtime |
| Tavily | web/event search tool | app runtime |
| LangSmith | tracing + observability | app runtime + debugging |
| Langfuse | golden dataset + RAGAS-like evaluation | eval pipeline |
| PostgreSQL + pgvector | app DB + vector search + memory persistence | app runtime |

---

## Required Environment Variables

All variables below are required unless marked optional.

### App Security

```bash
AI_ENGINEERING_SECRET_KEY=change-me
```

### LLM Providers

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Tool Provider

```bash
TAVILY_API_KEY=tvly-...
```

### LangSmith (Tracing / Observability)

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=event-sourcer
```

### Langfuse (Evaluation / Datasets / RAGAS-like)

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### Database

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ai_engineering
```

---

## Core npm Dependencies

### Backend / Agent Runtime

- `@langchain/langgraph`
- `@langchain/langgraph-checkpoint-postgres`
- `@langchain/core`
- `@langchain/openai`
- `@langchain/anthropic`
- `@langchain/community`
- `langsmith`
- `langfuse`
- `pgvector`
- `@tavily/core`
- `zod`
- `pg` (or project DB client already in use)

### Frontend

- `react`
- `react-dom`
- `react-router-dom`
- `tailwindcss` (v4)
- `vite`
- `@vitejs/plugin-react`

### TypeScript

- `typescript`
- `@types/node`
- `@types/react`
- `@types/react-dom`

---

## Required Database Capabilities

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Required Tables (minimum)

1. `ai_engineering_venues` (RAG knowledge base)
2. LangGraph checkpoint tables (for `PostgresSaver`)
3. LangGraph store tables (for `PostgresStore`)

Notes:
- `PostgresSaver.setup()` and `PostgresStore.setup()` should initialize required checkpoint/store schema.
- If schema is custom (not `public`), configure both saver/store accordingly.

---

## Required RAG + Retrieval Modules

- `server/rag/retrievers/naive.ts`
- `server/rag/retrievers/bm25.ts`
- `server/rag/retrievers/multiQuery.ts`
- `server/rag/retrievers/hybrid.ts`
- `server/rag/retrievers/index.ts` (factory/registry)

---

## Required Evaluation Artifacts (for Certification)

In final `docs/DELIVERABLES.md`, include:

1. Evaluator config names:
   - `ragas/faithfulness`
   - `ragas/answer_relevancy`
   - `ragas/context_precision`
   - `ragas/context_recall`
2. Metrics output tables:
   - baseline (naive)
   - retriever comparison
3. Evidence:
   - screenshots of evaluator config
   - experiment/export IDs for baseline and comparison runs

---

## Required Memory Capabilities

### Short-term (in-thread)

- `PostgresSaver` checkpointer
- every invocation uses `configurable.thread_id`

### Long-term (cross-thread)

- `PostgresStore` with namespaces
- at minimum:
  - `(session_key, "preferences")`
  - `(session_key, "search_history")`

---

## Keep-Updated Checklist

Update this file whenever any of the below change:

- dependency additions/removals
- env var additions/removals
- DB schema changes
- external services
- evaluation metric definitions
- memory model changes

