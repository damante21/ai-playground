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
- In-thread memory (short-term) and saved preferences (long-term)
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
apps/ai-engineering/
├── src/                     # Frontend app
├── server/                  # API, agents, retrieval, evaluation, memory
├── data/                    # Curated filtering heuristics (RAG source)
├── docs/                    # Certification deliverables
└── README.md
```

## Local Setup

For full setup requirements and local run steps, see:

- `docs/AI_ENGINEERING_PROJECT_REQUIREMENTS.md`
- `docs/AI_ENGINEERING_LOCAL_SETUP.md`

## Certification Submission

- **Loom Demo (<= 5 min):** `<ADD_LOOM_LINK>`
- **Demo URL (local):** `http://localhost:3000/ai-engineering`
- **Demo URL (public):** `https://jamesdamante.com/ai-engineering`
- **Written Deliverables:** `docs/DELIVERABLES.md`

## Development Notes

- This directory is intended to be pushed to the public repo via git subtree.
- Keep secrets out of this directory (`.env` is ignored).
- Only commit public-safe code and docs here.

