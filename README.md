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
- Multiple retrieval strategies (naive, BM25, multi-query, hybrid)
- Memory infrastructure wired (PostgresSaver + PostgresStore) — see [Future Enhancements](#future-enhancements)
- Tracing/observability and evaluation instrumentation

## High-Level Architecture

1. User submits city + filter preferences
2. Supervisor decomposes search into parallel research tasks
3. Researcher agents gather event candidates from web sources
4. Filter agent applies criteria using both raw results + retrieved context
5. Categorizer groups accepted events for final output
6. API returns structured, explainable recommendations

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

## Future Enhancements

### In-Thread Memory (Conversation Continuity)

The infrastructure for in-thread memory is fully wired: `PostgresSaver` connects to the database, the frontend tracks `threadId` across messages, and the graph compiles with the checkpointer. The remaining step is to pass `state.messages` (the full conversation history from the checkpoint) into the supervisor's LLM call instead of only the current `userQuery`. This change is in `server/agents/supervisor.ts` lines 75-90 — include `state.messages` in the model invocation array so the LLM sees prior turns.

### Cross-Thread Memory (Saved Preferences)

`PostgresStore` is connected and the store tables are auto-created. To implement saved preferences:

1. Add a `/api/ai-engineering/preferences` endpoint that reads/writes to the store using a user namespace
2. In the supervisor node, load saved preferences from the store at the start of each invocation
3. Merge saved preferences with the current query's filters
4. Add UI controls to save/load preference profiles

### Implementation Priority

Both features are additive — the current stateless-per-request behavior is correct and complete for the core use case. Memory would improve UX for repeat users but is not required for the event discovery pipeline.

## Development Notes

- This directory is intended to be pushed to the public repo via git subtree.
- Keep secrets out of this directory (`.env` is ignored).
- Only commit public-safe code and docs here.

