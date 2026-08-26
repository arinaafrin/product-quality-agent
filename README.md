# Product Quality Agent

A tool that checks product data, stores knowledge about the rules, and lets you ask questions about the results. Built on an e-commerce product feed as the example use case.
Stack: **Node.js/Express** backend, **React (Vite)** frontend, with GitLab CI/CD and Docker.

**What's inside:**
- 🤖 **Agent** — `agent.js` runs an Anthropic tool-use loop (`search_knowledge_base`), with offline fallback if no API key is set or a call fails.
- 🔌 **MCP support** — `mcp_server.js` exposes the same tools over MCP for Claude Desktop, Claude Code, or any MCP client.
- 📚 **RAG search** — `rag_store.js` is a TF-IDF search over rule docs and past validation runs (swappable for pgvector/Pinecone/Qdrant later).
- ✅ **Tested** — 59 Jest/Vitest unit tests (~93% backend coverage) + 8 Robot Framework API tests against the real running app, all run in CI.

> Only `backend/src/quality_engine.js` knows about "products." Swap it for a different data type (orders, sensor logs, CSV) and everything else — routes, search, MCP, agent, UI — keeps working.

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
│   │   ├── server.js
│   │   ├── routes/             # /api/validate, /api/rules, /api/ask
│   │   └── data/
│   │       ├── sample_feed.json
│   │       └── knowledge_base/
│   ├── scripts/build-kb.js
│   └── tests/
│       ├── ...                 # 33 Jest tests, ~93% statement coverage
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
# Backend
cd backend
cp .env.example .env        # ANTHROPIC_API_KEY optional
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
# frontend: http://localhost:8080, backend: http://localhost:4000
```

### As a standalone MCP server

```bash
cd backend && npm run mcp
```

## Testing and linting

```bash
# Backend
cd backend && npm test    # 33 Jest tests, mocked LLM loop, no API key needed
cd backend && npm run lint

# Frontend
cd frontend && npm test   # 26 Vitest + Testing Library tests
cd frontend && npm run lint
cd frontend && npm run build
```

Both suites run fully offline in CI (mocked `@anthropic-ai/sdk` and mocked `api.js`).

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