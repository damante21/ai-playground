# AI Powered Event Sourcer (AI Playground)

AI-powered community event discovery with values-based filtering.

## Overview

AI Powered Event Sourcer helps users find local events that match personal values and constraints (for example: free, alcohol-free, secular, apolitical, family-friendly).  
Instead of manually checking many listings, users submit one query and get categorized, explainable recommendations.

This project is built for an AI engineering certification challenge and focuses on:

- agentic orchestration (supervisor + specialist agents)
- retrieval-augmented filtering
- measurable evaluation of retrieval quality
- production-style observability and memory patterns

## Core Features

- Values-based event search by city
- Multi-agent workflow (supervisor, researchers, filter, categorizer)
- RAG context from curated filtering heuristics knowledge base (65 entries, 6 categories)
- Multiple retrieval strategies (naive, BM25, multi-query, hybrid, **ensemble**)
- **Ensemble retrieval** (default) — combines multi-query semantic, BM25 keyword, and naive vector search via weighted reciprocal rank fusion for best-of-all-worlds retrieval quality
- **Contextual reranking** — LLM-based reranker scores each retrieved heuristic against the query and drops low-relevance chunks, reducing noise in the filter agent's context window
- **Conversational refinement** — follow-up queries like "show me only the free ones" re-filter existing results without re-running the full search pipeline
- **Episodic memory** — the system learns from events users save and uses past successes as few-shot examples to improve future recommendations
- **Think tool** — the supervisor reasons step-by-step about query interpretation and search strategy before acting, improving routing quality for ambiguous queries
- **In-thread memory** via PostgresSaver checkpointer with conversation history in the supervisor prompt
- **Cross-thread memory** via PostgresStore for user preferences and episodic recall
- User authentication with application-scoped access (signup with secret key gate)
- My Events page with event saving, status management, .ics calendar export, and pre-event briefings
- **Agent evaluation pipeline** — Tool Call Accuracy, Agent Goal Accuracy, and Topic Adherence evaluators assess supervisor routing and decision quality across 12 test scenarios
- Tracing/observability and evaluation instrumentation

## High-Level Architecture

**New search flow:**
1. User submits city + filter preferences
2. Supervisor decomposes search into parallel research tasks
3. Researcher agents gather event candidates from web sources
4. Filter agent applies criteria using both raw results + retrieved context
5. Categorizer groups accepted events for final output
6. API returns structured, explainable recommendations

**Refinement flow (follow-up queries):**
1. User sends a follow-up like "show me only the outdoor ones"
2. Supervisor detects refinement intent and extracts criteria
3. Filter agent re-evaluates the previous results against the new criteria (skipping researchers and RAG)
4. Categorizer re-groups the narrowed results
5. API returns the refined subset

## Tech Stack

- **Language:** TypeScript
- **Frontend:** React + Vite + Tailwind v4
- **Backend:** Node.js + Express
- **Agent orchestration:** LangGraph.js
- **LLM integration:** LangChain.js
- **Models:** OpenAI + Anthropic
- **Retrieval:** PostgreSQL + pgvector
- **Tracing:** LangSmith
- **Evaluation:** Langfuse (RAGAS-style evaluators)
- **Search tool:** Tavily

## Repository Structure

```text
ai-engineering/
├── standalone/              # Standalone entry points (server, client, configs)
├── src/                     # Frontend React components
├── server/                  # API, agents, retrieval, evaluation, memory
├── data/                    # Curated filtering heuristics (RAG source)
├── docs/                    # Certification deliverables + setup guide
├── docker-compose.yml       # 3-service Docker stack
├── Dockerfile.server
├── Dockerfile.client
├── .env.example
└── package.json
```

## Quick Start

```bash
git clone https://github.com/damante21/ai-playground.git
cd ai-playground
cp .env.example .env   # Fill in your API keys
docker-compose up --build
# Open http://localhost:3000/ai-engineering
```

For detailed setup instructions, see `docs/AI_ENGINEERING_LOCAL_SETUP.md`.

## Certification Submission

- **Loom Demo (<= 5 min):** [Watch Demo](https://www.loom.com/share/4fe5a006cd9348499c9ed68b452531c6)
- **Demo URL (local):** `http://localhost:3000/ai-engineering`
- **Demo URL (public):** `https://jamesdamante.com/ai-engineering`
- **Written Deliverables:** `docs/DELIVERABLES.md`

## Memory Architecture

### In-Thread Memory (Conversation Continuity)
PostgresSaver checkpointer persists full graph state per `threadId`. The supervisor includes the last 10 messages as conversation history. This enables multi-turn interactions: initial searches, conversational refinement, and follow-up questions all within a single thread.

### Cross-Thread Memory (Preferences + Episodes)
PostgresStore provides two namespaces per user:
- **Preferences** — tracks favorite categories, frequent filters, saved event count, and last searched city
- **Episodes** — stores successful interactions (query, city, saved event details). On new searches, the 3 most semantically similar episodes are retrieved and injected as few-shot examples into both the supervisor and filter prompts.

### Conversational Refinement
When the supervisor detects a refinement intent (e.g., "show me only the free ones"), it routes directly to the filter node, skipping researchers and RAG retrieval. The filter re-evaluates the previous `filteredEvents` against the new criteria, then the categorizer re-groups the narrowed results.

## Running Evaluations

All eval scripts run inside Docker (requires Node 18+). With the container running:

```bash
# RAG retrieval evaluation (per-retriever)
docker compose exec server npm run eval:naive
docker compose exec server npm run eval:bm25
docker compose exec server npm run eval:multiquery
docker compose exec server npm run eval:hybrid
docker compose exec server npm run eval:all       # runs all four sequentially

# Agent behavior evaluation (supervisor routing, goal accuracy, topic adherence)
docker compose exec server npm run eval:agent
```

Results are reported to Langfuse and printed to the console.

## Development Notes

- This directory is intended to be pushed to the public repo via git subtree.
- Keep secrets out of this directory (`.env` is ignored).
- Only commit public-safe code and docs here.

