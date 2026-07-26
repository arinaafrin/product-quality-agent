# Product Quality Agent

A validation pipeline + RAG knowledge base + grounded agent, applied to an e-commerce product feed.
Stack: **Node.js/Express** backend, **React (Vite)** frontend — matching the
role's tech stack — with GitLab CI/CD and Docker throughout.

**Highlights:**
- 🤖 **Agent-based workflow** — `agent.js` runs a real Anthropic tool-use
  loop (`search_knowledge_base`), with automatic fallback to deterministic
  offline retrieval if no API key is set or a call fails.
- 🔌 **MCP integration** — `mcp_server.js` exposes the same validation +
  retrieval logic as MCP tools over stdio, callable from Claude Desktop,
  Claude Code, or any other MCP client.
- 📚 **RAG solution** — `rag_store.js` is a from-scratch TF-IDF retrieval
  store over rule docs and validation run logs, architected as a swap-in
  point for a real vector DB (pgvector/Pinecone/Qdrant) in production.
- ✅ **Production-ready QA** — 59 tests across backend (Jest/Supertest,
  ~93% statement coverage, including a mocked LLM tool-use loop) and
  frontend (Vitest/Testing Library), enforced in CI on every push.

> **Swap-in point:** the whole thing is built around one idea — the domain
> logic in `backend/src/quality_engine.js` is the only file you'd change to
> point this at a different data type (orders, IoT telemetry, log lines,
> generic CSV imports). `rag_store.js`, `mcp_server.js`, `agent.js`, the API
> routes, and the entire React UI stay almost untouched, since they just call
> whatever `validate()` and rule metadata a given engine exposes.

## What it does

1. **Validates** — upload a JSON product feed, get every record checked
   against 7 rules (missing title, invalid price, unsupported currency,
   broken image URL, unknown category, malformed SKU, duplicate SKU) with a
   pass/warn/reject verdict and a human-readable reason per failure.
2. **Explains** — every rule's rationale lives in a generated knowledge base
   doc, plus a hand-written FAQ on how to triage failures. A lightweight
   in-memory RAG store (TF-IDF, no external vector DB or API key required)
   indexes both the docs and every validation run you upload.
3. **Answers** — a chat agent answers grounded questions like *"why did
   today's import reject 40 items?"* or *"why does an unsupported currency
   get rejected?"*. By default it works with **zero configuration and no
   API key**: it retrieves from the RAG store and composes the answer
   directly from the retrieved text. Set `ANTHROPIC_API_KEY` to optionally
   upgrade it to an Anthropic-generated, more natural answer over the same
   grounded retrieval — with automatic fallback to the offline mode if that
   call ever fails.

## Architecture

```
product-quality-agent/
├── .gitlab-ci.yml          # lint → test → build (docker) → deploy
├── docker-compose.yml      # local full-stack run
├── backend/
│   ├── src/
│   │   ├── quality_engine.js   # <- swap this for a new data type
│   │   ├── rag_store.js        # TF-IDF retrieval (swap for pgvector/etc. in prod)
│   │   ├── mcp_server.js       # standalone MCP server (stdio) for external clients
│   │   ├── agent.js            # Anthropic tool-use loop for the chat feature
│   │   ├── server.js           # Express app
│   │   ├── routes/             # /api/validate, /api/rules, /api/ask
│   │   └── data/
│   │       ├── sample_feed.json
│   │       └── knowledge_base/ # validation-rules.md (generated) + faq.md (hand-written)
│   ├── scripts/build-kb.js     # regenerates validation-rules.md from rule metadata
│   └── tests/                  # 33 Jest tests: rule logic, RAG retrieval, agent (incl. mocked LLM tool-use loop), API/MCP routes — ~93% statement coverage
└── frontend/
    └── src/
        ├── App.jsx              # nav rail + chat drawer shell
        ├── components/
        │   ├── Dashboard.jsx    # uploader, stat cards, manifest strip, failure table
        │   ├── ManifestStrip.jsx# signature element: one hoverable tick per record
        │   ├── FailureTable.jsx
        │   ├── RulesView.jsx
        │   └── AgentChat.jsx
        ├── styles/index.css     # design tokens
        └── *.test.js(x)         # 26 Vitest + Testing Library tests, colocated per component
```

### Why two "agent" surfaces (`mcp_server.js` vs `agent.js`)?

- `mcp_server.js` is a real MCP server over stdio — point Claude Desktop,
  Claude Code, or any other MCP client at it (`node src/mcp_server.js`) and
  it can call `validate_feed`, `search_knowledge_base`, and `get_rule_docs`
  directly. This is the "MCP integrations" piece from the job spec.
- `agent.js` is the fast path used by the bundled React chat UI: by default
  it synthesizes an answer directly from `rag_store.js` retrieval results,
  no LLM call and no API key required. If `ANTHROPIC_API_KEY` is set, it
  upgrades to the Anthropic Messages API's tool-use loop over the same
  retrieval, falling back to offline synthesis on any error. Both this and
  `mcp_server.js` ultimately read from the same `rag_store.js` singleton.

## Running it locally

```bash
# Backend
cd backend
cp .env.example .env        # ANTHROPIC_API_KEY is optional — /api/ask works without it
npm install
npm run build-kb            # optional: regenerate the rules doc from quality_engine.js
npm run dev                 # http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Try it: open the frontend, upload `backend/src/data/sample_feed.json`, watch
the manifest strip populate, then open "Ask the agent" and ask why specific
SKUs were rejected.

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

## Testing & linting

```bash
# Backend — 33 Jest tests, ~93% statement / 96% line coverage
cd backend && npm test    # includes a mocked Anthropic tool-use loop (no real API key needed)
cd backend && npm run lint

# Frontend — 26 Vitest + React Testing Library tests
cd frontend && npm test   # component rendering, user interactions, API mocking
cd frontend && npm run lint
cd frontend && npm run build   # also acts as a compile smoke-test in CI
```

Both suites are designed to run fully offline in CI: the backend agent tests
mock `@anthropic-ai/sdk` to exercise the LLM tool-call loop, the turn limit,
and the fallback-to-offline-synthesis path without hitting a real API; the
frontend tests mock `api.js` so no backend needs to be running.

## CI/CD (`.gitlab-ci.yml`)

| Stage    | What happens |
|----------|--------------|
| `lint`   | ESLint on both `backend/` and `frontend/`, fails fast |
| `test`   | Jest (backend, with coverage + JUnit report), Vitest (frontend, component tests), and a Vite production build (frontend, as a compile check) |
| `build`  | On `main` or a tag: build & push both Docker images to the GitLab container registry, tagged with the commit SHA and `latest` |
| `deploy` | `staging` auto-deploys on `main`; `production` is a manual, tag-triggered job |

The `deploy` jobs are placeholders (`echo` statements) marking exactly where
to drop in `az containerapp update`, an UpCloud API call, or `kubectl
apply`/`helm upgrade` for the target infra — intentionally left open since
that depends on the specific Azure/UpCloud setup in use.

## Extending to a different data type

1. Duplicate `quality_engine.js`, replace the `rules` array with rules for
   the new record shape (keep the `{ ruleId, field, message, severity }`
   failure shape).
2. Run `npm run build-kb` to regenerate the knowledge base doc — or write a
   new `build-kb.js` if the new domain needs different narrative docs (an
   FAQ, a runbook).
3. Everything else — the API routes, the RAG store, the MCP server, the
   agent, and the React dashboard — works unchanged, since none of it knows
   anything about "products" specifically; it only knows about records,
   rules, and failures.
