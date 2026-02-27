# AI Engineering Local Setup

Step-by-step guide to run the AI Engineering project locally.

Companion file: `AI_ENGINEERING_PROJECT_REQUIREMENTS.md`

---

## 1) Prerequisites

- **Node.js** >= 20
- **Docker** and **Docker Compose**
- **PostgreSQL** 15+ (runs in Docker)
- API keys for: OpenAI, Anthropic, Tavily, LangSmith, Langfuse

---

## 2) Project Structure

This project is designed to run as part of a host Node.js/Express application. The AI engineering module provides:

- **Backend**: Agent logic, API routes, middleware — imported by the host Express server
- **Frontend**: React components — imported as a route in the host React app

```
ai-engineering/
├── server/               # Backend: agents, routes, middleware, tools
│   ├── agents/           # LangGraph agent nodes (supervisor, researcher, filter, categorizer)
│   ├── routes/           # Express route definitions
│   ├── middleware/        # Secret key auth middleware
│   └── tools/            # Tavily search tool wrapper
├── src/                  # Frontend: React components for /ai-engineering route
│   ├── pages/            # AIEngineeringPage
│   ├── components/       # SecretKeyGate, ChatInterface, ChatMessage
│   ├── hooks/            # useChat
│   └── lib/              # API client
├── data/                 # RAG source data (venues)
├── docs/                 # Deliverables and setup docs
└── package.json          # Lists peer dependencies (installed in host server)
```

---

## 3) Host Application Integration

The AI engineering module integrates into a host application as follows:

### Backend

The host Express server imports and mounts the AI engineering routes:

```typescript
import aiEngineeringRoutes from '<path-to>/ai-engineering/server/routes/aiEngineering'
app.use('/api/ai-engineering', aiEngineeringRoutes)
```

AI-specific dependencies (LangChain, Anthropic, Tavily, etc.) are installed in the host server's `package.json`. See the `peerDependencies` in this project's `package.json` for the full list.

### Frontend

The host React app adds a route that renders the AI engineering page:

```typescript
import AIEngineeringPage from '<path-to>/ai-engineering/src/pages/AIEngineeringPage'

<Route path="/ai-engineering" element={<AIEngineeringPage />} />
```

### Module Resolution

The AI engineering server code resolves packages from the host server's `node_modules/`. Locally, this is achieved via a symlink:

```bash
ln -s <path-to-host-server>/node_modules ai-engineering/node_modules
```

In Docker, the host server's node_modules volume is mounted at `ai-engineering/node_modules`.

---

## 4) Environment Variables

Add to the host server's `.env` file:

```bash
# AI Engineering - Access Gate
AI_ENGINEERING_SECRET_KEY=<your-secret-key>

# OpenAI (researcher + categorizer agents, embeddings)
OPENAI_API_KEY=sk-...

# Anthropic (supervisor + filter agents)
ANTHROPIC_API_KEY=sk-ant-...

# Tavily (web search tool for researcher agents)
TAVILY_API_KEY=tvly-...

# LangSmith (tracing + observability)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=event-sourcer

# Langfuse (golden datasets + RAGAS evaluation)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Never commit this file.

---

## 5) Database Setup

PostgreSQL with pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Additional tables needed:
- `ai_engineering_venues` — RAG venue knowledge base with vector embeddings
- LangGraph checkpoint/store tables — created automatically via `PostgresSaver.setup()` / `PostgresStore.setup()`

---

## 6) Running Locally

### With Docker (recommended)

```bash
docker compose up --build
```

- UI: `http://localhost:3000/ai-engineering`
- API: `http://localhost:8000/api/ai-engineering/health`

### Without Docker

1. Start PostgreSQL
2. Install host server dependencies: `cd <host-server> && npm install`
3. Create symlink: `ln -s <host-server>/node_modules ai-engineering/node_modules`
4. Start host server: `cd <host-server> && npm run dev`
5. Start host client: `cd <host-client> && npm run dev`
6. Open: `http://localhost:3000/ai-engineering`

---

## 7) Validate

### Health Check

```bash
curl http://localhost:8000/api/ai-engineering/health
```

Returns which API keys are configured (boolean flags, not the keys themselves).

### Access Gate

1. Open `/ai-engineering`
2. Enter the secret key from `.env`
3. Should grant access to the chat interface

### Chat

1. Type a query like "Find free family-friendly events in San Francisco"
2. The agent pipeline processes: supervisor → researchers → filter → categorizer
3. Response displays in the chat with categorized events

---

## 8) Troubleshooting

### Module not found errors

Ensure the `node_modules` symlink exists and points to the host server's node_modules:

```bash
ls -la ai-engineering/node_modules
```

### API key errors

Check the health endpoint to see which keys are missing:

```bash
curl http://localhost:8000/api/ai-engineering/health
```

### Docker node_modules issues

If packages aren't found in Docker, rebuild:

```bash
docker compose down && docker compose up --build
```
