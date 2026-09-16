# Product Quality Agent

A tool that checks product data, stores knowledge about the rules, and lets you ask questions about the results. Built on an e-commerce product feed as the example use case.
Stack: **Node.js/Express** backend, **React (Vite)** frontend, **Socket.IO + Redis** for live progress, with GitLab CI/CD and Docker.

**What's inside:**
- 🤖 **Agent** — `agent.js` runs an Anthropic tool-use loop (`search_knowledge_base`), with offline fallback if no API key is set or a call fails.
- 🔌 **MCP support** — `mcp_server.js` exposes the same tools over MCP for Claude Desktop, Claude Code, or any MCP client.
- 📚 **RAG search** — `rag_store.js` is a TF-IDF search over rule docs and past validation runs (swappable for pgvector/Pinecone/Qdrant later).
- ⚡ **Real-time progress** — `realtime.js` attaches Socket.IO to the backend, backed by a Redis pub/sub adapter (`@socket.io/redis-adapter`), so a validation run streams per-record progress to the browser as it happens instead of the client waiting on one large response. The Redis adapter is what would let this fan out across multiple backend instances in production, not just a single process.
- ✅ **Tested** — 62 Jest/Vitest unit tests (~93% backend coverage) + 8 Robot Framework API tests against the real running app, all run in CI.

> Only `backend/src/quality_engine.js` knows about "products." Swap it for a different data type (orders, sensor logs, CSV) and everything else — routes, search, MCP, agent, UI, and the real-time layer — keeps working.

## What it does

1. **Checks your data** — upload a JSON product feed, get each item checked against 7 rules (missing title, bad price, unsupported currency, broken image link, unknown category, bad SKU format, duplicate SKU), with a pass/warn/reject result and reason.
2. **Explains why** — each rule has a short write-up, plus a FAQ, indexed by a built-in TF-IDF search (no external DB or API key needed).
3. **Answers your questions** — ask things like *"why did today's import reject 40 items?"*. Works with no API key (offline search + synthesis); add `ANTHROPIC_API_KEY` to upgrade to a natural-language answer, with automatic fallback.

## How it's put together

```
product-quality-agent/
├── .gitlab-ci.yml          # lint → test → build (docker) → deploy
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── quality_engine.js   # <- swap this for a new data type
│   │   ├── rag_store.js
│   │   ├── mcp_server.js
│   │   ├── agent.js
│   │   ├── realtime.js         # Socket.IO server + Redis pub/sub adapter
│   │   ├── server.js
│   │   ├── routes/             # /api/validate, /api/rules, /api/ask
│   │   └── data/
│   │       ├── sample_feed.json
│   │       └── knowledge_base/
│   ├── scripts/build-kb.js
│   └── tests/
│       ├── ...                 # 36 Jest tests, ~93% statement coverage
│       └── robot/              # 8 Robot Framework API tests
│           ├── api_tests.robot
│           └── sample_feed.json
└── frontend/
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Dashboard.jsx
        │   ├── ManifestStrip.jsx
        │   ├── FailureTable.jsx
        │   ├── RulesView.jsx
        │   └── AgentChat.jsx
        ├── styles/index.css
        └── *.test.js(x)        # 26 Vitest + Testing Library tests
```

### Why two agent files (`mcp_server.js` vs `agent.js`)?

- `mcp_server.js` — real MCP server over stdio, for external clients (Claude Desktop, Claude Code, etc).
- `agent.js` — powers the in-app chat. Same underlying `rag_store.js`, but built for the React UI's request/response flow rather than MCP's tool-call protocol.

## Running it locally

```bash
# Redis (required for real-time progress; the app still runs without it —
# see "Real-time validation progress" below — but you'll only get the
# plain request/response flow)
docker run -p 6379:6379 redis:7-alpine

# Backend
cd backend
cp .env.example .env        # ANTHROPIC_API_KEY optional, REDIS_URL defaults to localhost:6379
npm install
npm run dev                 # http://localhost:4000

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

### With Docker Compose

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
# frontend: http://localhost:8080, backend: http://localhost:4000, redis: internal only
```

Compose now brings up a `redis` service alongside `backend`/`frontend` and waits on its healthcheck before starting the backend, so the real-time layer is live by default in this path.

### As a standalone MCP server

```bash
cd backend && npm run mcp
```

## Real-time validation progress

Uploading a feed used to be a single request/response: the client sent all records, waited, and got one summary back. For large feeds that means a long silent spinner with no feedback.

`POST /api/validate` now accepts an optional `jobId`. When one is present:

1. The frontend generates a `jobId` (`crypto.randomUUID()`), opens a Socket.IO connection, and joins a room named after that id (`socket.emit('validation:join', jobId)`) *before* sending the POST.
2. As `quality_engine.js` scores each record, the route batches results (5 at a time, or on the last record) and emits a `validation:progress` event to that room — `io.to(jobId).emit(...)`.
3. On completion, a `validation:complete` event fires with the final counts, and the HTTP response resolves with the full summary as before.

**Why Redis, not just Socket.IO on its own:** a bare Socket.IO server keeps its rooms in local process memory. That's fine for one backend instance, but the moment you run more than one (which is the normal way to scale a Node service — more processes, not a bigger one), a client connected to instance A never sees an event emitted by instance B, even if they're both handling requests for the same `jobId`. `@socket.io/redis-adapter` fixes that: every instance publishes emitted events to Redis, every instance's clients receive them regardless of which process they're actually connected to. Using Redis here isn't just "another checkbox skill" — it's the specific mechanism that makes the real-time feature correct once you're not running a single process anymore.

**Why this degrades safely, not silently breaks:** `realtime.js` is only initialized when the server actually starts listening (`server.js`, guarded by `require.main === module`), never when something just does `require('./server')` — which is exactly what Jest/Supertest do to test the Express `app` in isolation. If Redis is unreachable, `initRealtime()` rejects, `server.js` logs it and keeps serving plain HTTP/REST, and `routes/validate.js` treats a `null` Socket.IO instance as "no live listeners" — the response shape and status codes are identical either way. Every existing test in the suite runs with zero knowledge that Socket.IO/Redis exist at all.

## Testing and linting

```bash
# Backend
cd backend && npm test    # 36 Jest tests, mocked LLM loop, no API key or Redis needed
cd backend && npm run lint

# Frontend
cd frontend && npm test   # 26 Vitest + Testing Library tests
cd frontend && npm run lint
cd frontend && npm run build
```

Both suites run fully offline in CI (mocked `@anthropic-ai/sdk` and mocked `api.js`). The real-time layer is exercised manually/in Docker Compose rather than in the unit suite — see the note above on why the suite never needs a live Redis instance.

### API tests (Robot Framework)

Separate suite that calls the real, running API — no mocks. Catches issues unit tests can't, like wrong request/response shapes.

```bash
# with the backend running (npm run dev)
cd backend/tests/robot
pip install robotframework robotframework-requests
robot api_tests.robot
```

Covers `/api/validate`, `/api/rules`, `/api/ask`, including error cases (missing title, bad request body). Generates `report.html` with pass/fail results.

## CI/CD (`.gitlab-ci.yml`)

| Stage    | What happens |
|----------|--------------|
| `lint`   | ESLint on backend + frontend |
| `test`   | Jest, Robot Framework API tests, Vitest, Vite build check |
| `build`  | On `main`/tag: builds and pushes Docker images to the GitLab registry |
| `deploy` | `staging` auto-deploys on `main`; `production` is manual, tag-triggered |

`deploy` jobs are placeholders (`echo` statements) — swap in `az containerapp update`, an UpCloud API call, or `kubectl apply`/`helm upgrade` for your infra.

## Using it for a different kind of data

1. Copy `quality_engine.js`, replace the `rules` array (keep the `{ ruleId, field, message, severity }` failure shape).
2. Run `npm run build-kb` to rebuild the knowledge base doc.
3. Everything else — routes, search, MCP server, agent, React UI — works unchanged.