# Certification Deliverables

This document is the final written submission for the certification challenge.

- Public repo: `https://github.com/damante21/ai-playground`
- Demo URL (local/public): `http://localhost:3000/ai-engineering` (planned local URL)
- Loom demo URL (<= 5 min): `<ADD_LOOM_URL>`
- Loom runtime: `<ADD_RUNTIME>`
- Last updated: `2026-02-26`

---

## Submission Evidence Index

### Global Requirements

- [ ] Public GitHub repo link included
- [ ] Loom video <= 5 minutes included
- [ ] Written document addresses all deliverables
- [ ] All relevant code in repo
- [ ] Local setup docs present:
  - `AI_ENGINEERING_PROJECT_REQUIREMENTS.md`
  - `AI_ENGINEERING_LOCAL_SETUP.md`

### Evaluation Evidence (Required)

- [ ] Evaluator config names listed:
  - `ragas/faithfulness`
  - `ragas/answer_relevancy`
  - `ragas/context_precision`
  - `ragas/context_recall`
- [ ] Evaluator config screenshots added
- [ ] Baseline experiment/export ID(s) added
- [ ] Retriever comparison experiment/export ID(s) added
- [ ] Baseline metrics table added
- [ ] Comparison metrics table added

---

## 1) Problem, Audience, Scope (9 pts)

### 1.1 One-Sentence Problem Statement (2 pts)

Finding community events that match personal values and safety criteria requires manually searching fragmented platforms and vetting dozens of listings, turning what should be a 5-minute task into an hour-long research project.

### 1.2 Why This Is a Problem for This User (5 pts)

The target user for this application includes parents, individuals in recovery, people seeking secular/apolitical spaces, and newcomers to a city. Existing event platforms optimize for volume and engagement, not values alignment. In practice, users must open 20-30 listings, read fine print, cross-check venue details, and infer context that is often not explicit in metadata. A listing labeled "community networking" may be bar-centered, a "free gathering" may be religiously affiliated, and a "family event" may include political sponsorships. This creates high time cost, repeated mismatch, and decision fatigue that reduces follow-through.

For newcomers, the problem is worse because they lack local context about venues and organizers. They cannot easily tell which spaces are genuinely family-friendly, secular, or safe without additional investigation. Attending a mismatched event has high social cost and can increase isolation rather than reduce it. SafeSpace Events addresses this by combining broad public search with values-based AI filtering and contextual venue retrieval, so users can find a short list of high-fit events quickly and with confidence.

### 1.3 Evaluation Questions / Input-Output Pairs (2 pts)

> Include at least 10.

| # | User Input / Question | Expected Behavior / Output |
|---|---|---|
| 1 | "Find free family-friendly events in San Francisco this weekend." | Returns categorized events with date/time/source and match explanations. |
| 2 | "Same query, but no alcohol-focused venues." | Removes alcohol-centric events and updates confidence/match rationale. |
| 3 | "Show only secular options." | Excludes events with explicit/implicit religious framing. |
| 4 | "I just moved to Austin. Find safe beginner social events." | Returns newcomer-appropriate categories with clear rationale and risk-aware filtering. |
| 5 | "Give me learning-focused events under free only." | Prioritizes Learning category, enforces free constraint. |
| 6 | "These look too broad. Show stricter matches only." | Applies tighter filtering threshold and returns fewer, higher-confidence events. |
| 7 | "Save these preferences for next time." | Persists preference profile to long-term memory namespace. |
| 8 | "Use my saved preferences and search Seattle." | Loads saved preferences and runs query with city changed. |
| 9 | "Why did this event pass the filter?" | Provides one-line grounded explanation tied to retrieved context. |
| 10 | "Compare this to raw Eventbrite results." | Shows filtered set quality vs broad source listings (manually in demo/workflow). |

---

## 2) Proposed Solution (15 pts)

### 2.1 Solution Description (1-2 paragraphs) (6 pts)

SafeSpace Events is an agentic event discovery application that accepts a city plus values-based constraints (for example: free, alcohol-free, secular, apolitical, family-friendly). The UX is a focused search interface that returns categorized event recommendations in 30-60 seconds, where each event includes source, date/time, confidence score, and a brief explanation of why it matches user criteria. The system is designed to feel like a trusted local researcher that pre-vets options instead of forcing users to manually inspect many low-signal listings.

The backend uses a supervisor-researcher pattern: a supervisor agent decomposes the request into parallel research tasks, researcher agents gather candidate events via Tavily, a filter agent applies values-based reasoning with RAG context, and a categorization agent organizes final outputs. The application is implemented in TypeScript using LangGraph.js and LangChain.js, with OpenAI + Anthropic model roles split by cost/reasoning profile. It includes in-thread memory for conversational refinement and cross-thread memory for saved preferences.

### 2.2 Infrastructure Diagram + Tooling Rationale (7 pts)

#### Infrastructure Diagram

`<INSERT_FINAL_DIAGRAM_IMAGE_OR_LINK>`

#### Tooling Choices (One sentence each)

1. **LLM(s):** OpenAI `gpt-4o-mini` handles cost-sensitive high-volume worker tasks while Anthropic Claude Sonnet handles complex supervisor/filter reasoning where precision matters most.
2. **Agent orchestration framework:** LangGraph.js provides explicit node/edge/state control for supervisor-researcher decomposition and iterative routing.
3. **Tool(s):** Tavily Search API gives broad web coverage of event sources and returns structured enough outputs for downstream filtering.
4. **Embedding model:** `text-embedding-3-small` offers good quality-cost tradeoff for venue/event semantic retrieval.
5. **Vector database:** PostgreSQL + pgvector reuses existing infrastructure while supporting semantic nearest-neighbor retrieval.
6. **Monitoring tool:** LangSmith is used for full execution tracing, node latency/cost visibility, and debugging.
7. **Evaluation framework:** Langfuse is used for golden datasets and RAGAS-style evaluator workflows across baseline and retriever comparisons.
8. **User interface:** React + Vite + Tailwind v4 enables fast iteration and a clean filter-first UX for demo and production-like behavior.
9. **Deployment tool:** Docker with the existing Node/Express server keeps deployment simple and consistent with the current site architecture.
10. **Other components:** LangChain.js standardizes model/tool interfaces and Zod ensures typed structured outputs and validation.

### 2.3 RAG and Agent Components (2 pts)

#### RAG Components

- Curated venue/community-space dataset with values-relevant attributes (alcohol-free, secular, family-friendly, etc.) as personal uploaded data.
- Ingestion pipeline creates embeddings and stores vectors + metadata in `ai_engineering_venues` (pgvector).
- Retrieval layer includes naive, BM25, multi-query, and hybrid strategies with shared interface and evaluation comparison.

#### Agent Components

- Supervisor node: decomposes query into platform-specific research tasks and controls iteration depth.
- Researcher nodes: execute parallel searches across event sources using Tavily.
- Filter node: applies values-based reasoning and combines raw results with retrieved RAG context.
- Categorizer node: groups accepted events into user-facing categories.
- Control flow: conditional routing lets supervisor continue research or proceed to filtering based on evidence quality/quantity.

#### Interaction

The agent system gathers and structures live event candidates, while RAG adds stable contextual facts about venues and spaces. During filtering, the model can ground decisions in both sources: real-time event descriptions from Tavily plus known venue characteristics from the vector store. This reduces false positives and supports explainable match rationales.

---

## 3) Data + External API (10 pts)

### 3.1 Data Sources and External APIs (5 pts)

#### Data Sources

- Personal curated venue/community-space dataset (RAG): stores values-aligned attributes and contextual notes used to improve filter accuracy.
- Public event listing content from web sources: candidate event descriptions, dates, and URLs for real-time discovery.

#### External APIs

- Tavily Search API: retrieves event candidates across platforms and local sources for researcher agents.
- OpenAI API: embeddings (`text-embedding-3-small`) and cost-effective worker tasks (`gpt-4o-mini`) in retrieval and agent substeps.
- Anthropic API: higher-reasoning supervisor/filter decisions where nuanced values interpretation is required.

#### Runtime Interaction

At query time, the supervisor creates parallel research tasks and researcher agents call Tavily to gather raw candidates. The filter stage performs retrieval against the venue knowledge base in pgvector to fetch contextual facts, then applies values-based reasoning using model calls to decide pass/fail and produce explanations. The categorizer organizes accepted events into output groups and returns a structured response to the UI.

### 3.2 Default Chunking Strategy + Why (5 pts)

- Chunking strategy: Each venue/community-space record is treated as a single semantic document chunk.
- Chunk size/overlap: One venue per chunk (typically ~200-500 tokens), overlap not required for structured venue records.
- Metadata strategy: Store city, venue type, and values attributes as metadata for filtering and scoring.
- Why this strategy: Venue records are naturally bounded documents, so per-record chunking maximizes interpretability and keeps retrieval grounded to explicit source facts.

---

## 4) End-to-End Prototype (15 pts)

### 4.1 Local Prototype Evidence

- Local run command(s): `<COMMANDS>`
- Local URL(s): `<URLS>`
- Features demonstrated:
  - [ ] Secret-key access gate
  - [ ] End-to-end search
  - [ ] RAG context retrieval
  - [ ] Multi-agent orchestration
  - [ ] Categorized output
  - [ ] Memory behavior (thread + saved preferences)

### 4.2 Demo Evidence

- Loom URL: `<ADD_LOOM_URL>`
- Loom runtime: `<ADD_RUNTIME_UNDER_5_MIN>`
- What is shown in demo:
  - `<ITEM_1>`
  - `<ITEM_2>`
  - `<ITEM_3>`

---

## 5) Evals Baseline (15 pts)

### 5.1 RAGAS Evaluator Configuration (Required Evidence)

#### Evaluator Config Names

- `ragas/faithfulness`
- `ragas/answer_relevancy`
- `ragas/context_precision`
- `ragas/context_recall`

#### Evaluator Config Screenshots

- `<ADD_SCREENSHOT_LINK_OR_PATH_1>`
- `<ADD_SCREENSHOT_LINK_OR_PATH_2>`

#### Baseline Experiment Metadata

- Experiment/export ID(s): `<ADD_IDS>`
- Dataset name: `<ADD_DATASET_NAME>`
- Retriever used: `naive`

### 5.2 Baseline Metrics Table (10 pts)

| Metric | Score | Notes |
|---|---:|---|
| Faithfulness | `<score>` | `<note>` |
| Response relevance | `<score>` | `<note>` |
| Context precision | `<score>` | `<note>` |
| Context recall | `<score>` | `<note>` |

### 5.3 Conclusions (5 pts)

`<WRITE_CONCLUSIONS_ON_PERFORMANCE_EFFECTIVENESS>`

---

## 6) Improve Retriever + Compare (14 pts)

### 6.1 Advanced Retrieval Choice + Why (2 pts)

- Chosen technique: `<NAME>`
- Why useful for this use case (1-2 sentences): `<RATIONALE>`

### 6.2 Implementation Summary (10 pts)

- Implemented retrievers:
  - [ ] naive
  - [ ] bm25
  - [ ] multi-query
  - [ ] hybrid
- Final selected production retriever: `<NAME>`
- Code locations:
  - `server/rag/retrievers/naive.ts`
  - `server/rag/retrievers/bm25.ts`
  - `server/rag/retrievers/multiQuery.ts`
  - `server/rag/retrievers/hybrid.ts`
  - `server/rag/retrievers/index.ts`

### 6.3 Comparison Results (2 pts)

#### Experiment Evidence

- Comparison experiment/export ID(s): `<ADD_IDS>`
- Comparison screenshot(s): `<ADD_SCREENSHOT_LINKS>`

#### Comparison Metrics Table

| Metric | Naive | BM25 | Multi-Query | Hybrid | Selected |
|---|---:|---:|---:|---:|---|
| Faithfulness | `<v>` | `<v>` | `<v>` | `<v>` | `<yes/no>` |
| Response relevance | `<v>` | `<v>` | `<v>` | `<v>` | `<yes/no>` |
| Context precision | `<v>` | `<v>` | `<v>` | `<v>` | `<yes/no>` |
| Context recall | `<v>` | `<v>` | `<v>` | `<v>` | `<yes/no>` |
| Avg latency (ms) | `<v>` | `<v>` | `<v>` | `<v>` | `<note>` |

#### Analysis

`<HOW_PERFORMANCE_CHANGED_VS_BASELINE>`

---

## 7) Next Steps (2 pts)

### Dense Vector Retrieval for Demo Day: Keep or Change?

`<DIRECT_ANSWER>`

### Why

`<RATIONALE_USING_EVAL_RESULTS>`

---

## Evidence Appendix

### A) Run Commands Used

```bash
<PASTE_COMMANDS_USED_FOR_RUN_AND_EVAL>
```

### B) Links and IDs

- Public repo: `https://github.com/damante21/ai-playground`
- Loom URL: `<ADD>`
- Baseline experiment/export ID(s): `<ADD>`
- Comparison experiment/export ID(s): `<ADD>`
- Dataset ID/name: `<ADD>`

### C) Screenshots

- Evaluator config screenshot 1: `<ADD>`
- Evaluator config screenshot 2: `<ADD>`
- Baseline results screenshot: `<ADD>`
- Comparison results screenshot: `<ADD>`

---

## Final Pass Gate

- [ ] All rubric sections completed
- [ ] All four required metrics shown in Task 5 and Task 6
- [ ] Evaluator config names included exactly
- [ ] Screenshots + experiment/export IDs included
- [ ] Loom <= 5 minutes and linked
- [ ] Public repo links and run instructions verified

