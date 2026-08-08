# Product Quality Agent

A tool that checks product data, stores knowledge about the rules, and lets you ask questions about the results. Built on an e-commerce product feed as the example use case.
Stack: **Node.js/Express** backend, **React (Vite)** frontend, with GitLab CI/CD and Docker.

**What's inside:**
- 🤖 **An agent that answers questions** — `agent.js` runs a real Anthropic tool-use
  loop (`search_knowledge_base`). If no API key is set, or a call fails, it falls
  back to a simpler offline search so it still works.
- 🔌 **MCP support** — `mcp_server.js` exposes the same checks and search tools
  through MCP, so Claude Desktop, Claude Code, or any other MCP client can call
  them directly.
- 📚 **Its own search system (RAG)** — `rag_store.js` is a simple TF-IDF search
  built from scratch, over the rule docs and past validation runs. It's built so
  you could swap in a real vector database (pgvector, Pinecone, Qdrant) later
  without much rework.
- ✅ **Well-tested** — 59 tests across backend (Jest/Supertest, ~93% statement
  coverage, including a mocked LLM loop) and frontend (Vitest/Testing Library),
  run automatically in CI on every push.

> **Built to be reused:** almost everything here is generic on purpose. The only
> file that actually knows about "products" is `backend/src/quality_engine.js`.
> Swap that one file for a different data type (orders, sensor logs, CSV
> imports, anything) and the search system, the MCP server, the agent, the API
> routes, and the whole React UI keep working as-is.

## What it does

1. **Checks your data** — upload a JSON product feed and every item gets checked
   against 7 rules (missing title, bad price, unsupported currency, broken
   image link, unknown category, bad SKU format, duplicate SKU). Each item gets
   a pass/warn/reject result with a plain-English reason.
2. **Explains why** — every rule has a short write-up explaining what it checks
   and why, plus a FAQ for common questions. A lightweight built-in search
   (TF-IDF, no external database or API key needed) indexes both the docs and
   every validation run you upload.
3. **Answers your questions** — ask things like *"why did today's import reject
   40 items?"* or *"why does an unsupported currency get rejected?"* and get a
   grounded answer. It works out of the box with **no setup and no API key**:
   it searches its own knowledge base and builds an answer from what it finds.
   If you add an `ANTHROPIC_API_KEY`, it upgrades to a more natural,
   Anthropic-generated answer over the same search results, and still falls
   back to the simple version if that call ever fails.

## How it's put together

```
product-quality-agent/
├── .gitlab-ci.yml          # lint → test → build (docker) → deploy
├── docker-compose.yml      # local full-stack run
├── backend/
│   ├── src/
│   │   ├── quality_engine.js   # <- swap this for a new data type
│   │   ├── rag_store.js        # TF-IDF search (swap for pgvector/etc. later)
│   │   ├── mcp_server.js       # standalone MCP server (stdio) for outside clients
│   │   ├── agent.js            # Anthropic tool-use loop for the chat feature
│   │   ├── server.js           # Express app
│   │   ├── routes/             # /api/validate, /api/rules, /api/ask
│   │   └── data/
│   │       ├── sample_feed.json
│   │       └── knowledge_base/ # validation-rules.md (auto-generated) + faq.md (written by hand)
│   ├── scripts/build-kb.js     # rebuilds validation-rules.md from the rules themselves
│   └── tests/                  # 33 Jest tests: rules, search, agent (with a mocked LLM loop), API/MCP routes — ~93% statement coverage
└── frontend/
    └── src/
        ├── App.jsx              # nav rail + chat drawer shell
        ├── components/
        │   ├── Dashboard.jsx    # uploader, stat cards, manifest strip, failure table
        │   ├── ManifestStrip.jsx# a hoverable tick for every record
        │   ├── FailureTable.jsx
        │   ├── RulesView.jsx
        │   └── AgentChat.jsx
        ├── styles/index.css     # design tokens
        └── *.test.js(x)         # 26 Vitest + Testing Library tests, next to each component
```

### Why are there two "agent" files (`mcp_server.js` and `agent.js`)?

- `mcp_server.js` is a real MCP server that runs over stdio. Point Claude
  Desktop, Claude Code, or any other MCP client at it (`node src/mcp_server.js`)
  and it can call `validate_feed`, `search_knowledge_base`, and `get_rule_docs`
  directly. This is what lets outside tools use the agent, not just the app's
  own UI.
- `agent.js` is what powers the chat feature in the React app. By default it
  builds an answer straight from a `rag_store.js` search, no LLM call and no
  API key needed. Set `ANTHROPIC_API_KEY` and it upgrades to the Anthropic
  Messages API's tool-use loop over the same search results, falling back to
  the simple version if anything goes wrong. Both files read from the same
  `rag_store.js` underneath.

## Running it locally

```bash
# Backend
cd backend
cp .env.example .env        # ANTHROPIC_API_KEY is optional — /api/ask works without it
npm install
npm run build-kb            # optional: rebuild the rules doc from quality_engine.js
npm run dev                 # http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Try it: open the frontend, upload `backend/src/data/sample_feed.json`, watch
the manifest strip fill in, then open "Ask the agent" and ask why certain
SKUs got rejected.

### With Docker Compose

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
# frontend: http://localhost:8080  (nginx proxies /api to the backend service)
# backend:  http://localhost:4000
```

### As a standalone MCP server

```bash
cd backend
npm run mcp
```

## Testing and linting

```bash
# Backend — 33 Jest tests, ~93% statement / 96% line coverage
cd backend && npm test    # includes a mocked Anthropic tool-use loop (no real API key needed)
cd backend && npm run lint

# Frontend — 26 Vitest + React Testing Library tests
cd frontend && npm test   # component rendering, user interactions, API mocking
cd frontend && npm run lint
cd frontend && npm run build   # also works as a build check in CI
```

Both test suites run fully offline in CI: the backend agent tests mock
`@anthropic-ai/sdk` to test the LLM tool-call loop, the turn limit, and the
fallback path, without ever calling the real API. The frontend tests mock
`api.js`, so no backend needs to be running.

## CI/CD (`.gitlab-ci.yml`)

| Stage    | What happens |
|----------|--------------|
| `lint`   | ESLint on both `backend/` and `frontend/`, fails fast |
| `test`   | Jest (backend, with coverage + JUnit report), Vitest (frontend, component tests), and a Vite production build (frontend, as a build check) |
| `build`  | On `main` or a tag: builds and pushes both Docker images to the GitLab container registry, tagged with the commit SHA and `latest` |
| `deploy` | `staging` deploys automatically on `main`; `production` is manual and tag-triggered |

The `deploy` jobs are placeholders (just `echo` statements) marking where
you'd add `az containerapp update`, an UpCloud API call, or `kubectl
apply`/`helm upgrade`. Left open on purpose, since that depends on whatever
Azure or UpCloud setup you're using.

## Using it for a different kind of data

1. Copy `quality_engine.js`, and replace the `rules` array with rules for your
   new data (keep the same `{ ruleId, field, message, severity }` shape for
   failures).
2. Run `npm run build-kb` to rebuild the knowledge base doc — or write a new
   `build-kb.js` if your domain needs different docs (an FAQ, a runbook, etc).
3. Everything else — the API routes, the search system, the MCP server, the
   agent, and the React dashboard — keeps working without changes, since none
   of it actually knows anything about "products." It only knows about
   records, rules, and failures.
