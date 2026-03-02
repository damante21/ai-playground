# AI Engineering — Local Setup

Run the AI Powered Event Sourcer locally with a single command.

---

## Prerequisites

- **Docker** and **Docker Compose** (v2)
- API keys for: **OpenAI**, **Anthropic**, **Tavily**, **LangSmith**, **Langfuse**

That's it — Node.js, PostgreSQL, and pgvector all run inside Docker containers.

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/damante21/ai-playground.git
cd ai-playground

# 2. Create your .env from the template
cp .env.example .env
# → Fill in your API keys (see section below)

# 3. Start everything
docker-compose up --build

# 4. Open the app
# → http://localhost:3000/ai-engineering
```

On first boot the server automatically:
1. Runs database migrations (pgvector extension, filtering_heuristics table, FTS indexes)
2. Ingests the heuristics dataset into pgvector

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Purpose |
|---|:---:|---|
| `AI_ENGINEERING_SECRET_KEY` | Yes | Access gate passphrase |
| `JWT_SECRET` | Yes | Signs auth tokens |
| `OPENAI_API_KEY` | Yes | Researcher + categorizer agents, embeddings |
| `ANTHROPIC_API_KEY` | Yes | Supervisor + filter agents |
| `TAVILY_API_KEY` | Yes | Web search tool |
| `LANGCHAIN_TRACING_V2` | No | Enable LangSmith tracing (`true`) |
| `LANGCHAIN_API_KEY` | No | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | LangSmith project name |
| `LANGFUSE_PUBLIC_KEY` | No | Langfuse evaluation public key |
| `LANGFUSE_SECRET_KEY` | No | Langfuse evaluation secret key |
| `LANGFUSE_BASE_URL` | No | Langfuse host URL |
| `DATABASE_URL` | No | Auto-set by docker-compose |

---

## Project Structure

```
ai-engineering/
├── standalone/             # Standalone entry points (server, client, configs)
│   ├── server.ts           # Express bootstrap — migrations + ingestion + routes
│   ├── index.html          # Vite HTML entry
│   ├── main.tsx            # React root
│   ├── App.tsx             # Router (/ → /ai-engineering)
│   ├── tailwind.css        # Tailwind v4 entry
│   ├── vite.config.ts      # Vite dev config with API proxy
│   ├── tsconfig.server.json
│   ├── tsconfig.client.json
│   └── migrations/         # SQL migrations run on startup
├── server/                 # Backend logic
│   ├── agents/             # LangGraph nodes (supervisor, researcher, filter, categorizer)
│   ├── routes/             # Express route definitions
│   ├── middleware/          # Secret key auth middleware
│   ├── rag/                # RAG retrievers (naive, BM25, multi-query, hybrid)
│   ├── memory/             # LangGraph checkpointer + cross-thread store
│   ├── tools/              # Tavily search wrapper
│   └── eval/               # RAGAS evaluation harness
├── src/                    # Frontend React components
│   ├── pages/              # AIEngineeringPage, EvalDashboardPage
│   ├── components/         # SecretKeyGate, ChatInterface, ChatMessage, eval/*
│   ├── hooks/              # useChat
│   └── lib/                # API client
├── data/                   # Heuristics JSON + Langfuse CSV exports
├── docs/                   # Deliverables, requirements, setup docs
├── docker-compose.yml      # 3-service stack (postgres, server, client)
├── Dockerfile.server
├── Dockerfile.client
├── .env.example
└── package.json
```

---

## Services

| Service | Port | Description |
|---|---|---|
| `postgres` | 5432 | pgvector/pgvector:pg15 — vector DB with FTS |
| `server` | 8000 | Node.js Express API |
| `client` | 3000 | Vite dev server (React + Tailwind) |

---

## Running Without Docker

If you prefer running natively:

```bash
# 1. Install deps
npm install

# 2. Start PostgreSQL with pgvector locally (or use a managed instance)
#    Set DATABASE_URL in .env pointing to your Postgres

# 3. Start the server
npm run dev:server

# 4. In a second terminal, start the client
npm run dev:client

# 5. Open http://localhost:3000/ai-engineering
```

---

## Running Evaluations

RAGAS evaluations use a golden dataset in Langfuse and LLM-as-judge scoring.

```bash
# Run against a specific retriever
npm run eval:naive
npm run eval:bm25
npm run eval:multiQuery
npm run eval:hybrid
```

Results are pushed to Langfuse as experiment runs. View them in the Langfuse dashboard or at `/ai-engineering/eval` in the app.

---

## Validate

### Health Check

```bash
curl http://localhost:8000/health
```

### Access Gate

1. Open `http://localhost:3000/ai-engineering`
2. Enter the `AI_ENGINEERING_SECRET_KEY` value from `.env`
3. Should grant access to the chat interface

### Chat

1. Type a query like "Find free family-friendly events in San Francisco"
2. The agent pipeline processes: supervisor → researchers → filter → categorizer
3. Response displays categorized events with match explanations

### Eval Dashboard

Navigate to `http://localhost:3000/ai-engineering/eval` to see RAGAS metrics and retriever comparisons.

---

## Troubleshooting

### Container won't start

```bash
docker-compose down -v && docker-compose up --build
```

The `-v` flag removes the postgres volume — use only if you want a fresh database.

### API key errors

Check the health endpoint:

```bash
curl http://localhost:8000/api/ai-engineering/health
```

Returns boolean flags showing which keys are configured.

### Port conflicts

If 3000, 5432, or 8000 are in use, either stop the conflicting process or change ports in `docker-compose.yml`.
