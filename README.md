# Product Quality Agent

A tool that validates structured business records against a rule set, stores knowledge about
those rules, and lets you ask questions about the results. Ships with two interchangeable
domains: an e-commerce product feed, and Finnish invoice/accounting records (VAT rates,
invoice numbers, vendor IDs, duplicate/future-dated invoice detection).

Stack: **Node.js/Express** backend, **React (Vite)** frontend, **Socket.IO + Redis** for live
progress, **JWT auth**, with GitLab CI/CD and Docker.

**What's inside:**
- 🔐 **Auth** — `src/auth.js` + `routes/auth.js`: API-key-to-JWT exchange, every route
  protected, per-tenant data isolation. See [SECURITY.md](./SECURITY.md).
- 🔀 **Pluggable domain engines** — `src/engines/` holds a `product` and an `invoice` rule
  engine behind a common interface; `ACTIVE_ENGINE` picks which one runs, with zero other
  code changes (routes, RAG, agent, MCP server, knowledge base all follow automatically).
- 🤖 **Agent** — `agent.js` runs an Anthropic tool-use loop (`search_knowledge_base`), with
  offline fallback if no API key is set or a call fails.
- 🔌 **MCP support** — `mcp_server.js` exposes the same tools over MCP for Claude Desktop,
  Claude Code, or any MCP client.
- 📚 **RAG search** — `rag_store.js` is a TF-IDF search over rule docs and past validation
  runs (swappable for pgvector/Pinecone/Qdrant later).
- ⚡ **Real-time progress** — `realtime.js` attaches Socket.IO to the backend, backed by a
  Redis pub/sub adapter, so a validation run streams per-record progress to the browser as it
  happens. Sockets authenticate with the same JWT as REST calls and are scoped per tenant.
- ✅ **Tested** — 58 Jest tests (backend, ~82% statement coverage) + 35 Vitest/Testing
  Library tests (frontend) + 10 Robot Framework tests against the real running app, all run
  in CI.

> Only `backend/src/engines/*.js` knows about "products" or "invoices." Everything else —
> routes, auth, search, MCP, agent, UI, real-time — works unchanged across both.

## What it does

1. **Checks your data** — upload a feed, get each item checked against the active engine's
   rules (7 for products, 8 for invoices), with a pass/warn/reject result and reason.
2. **Explains why** — each rule has a short write-up, plus a FAQ, indexed by a built-in
   TF-IDF search (no external DB or API key needed).
3. **Answers your questions** — ask things like *"why did today's import reject 40 items?"*.
   Works with no API key (offline search + synthesis); add `ANTHROPIC_API_KEY` to upgrade to
   a natural-language answer, with automatic fallback.

All of this sits behind auth: sign in with an API key, get a session token, and every run,
history entry, and live progress update is scoped to your tenant only.

## How it's put together

```
product-quality-agent/
├── SECURITY.md              # threat model, what's protected, what isn't
├── .gitlab-ci.yml            # lint → test → build (docker) → deploy
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── engines/
│   │   │   ├── index.js             # engine registry (name -> module)
│   │   │   ├── product_quality_engine.js
│   │   │   └── invoice_quality_engine.js
│   │   ├── quality_engine.js        # <- dispatcher, picks the active engine
│   │   ├── auth.js                  # JWT sign/verify, requireAuth middleware
│   │   ├── corsConfig.js            # shared allowlist for REST + Socket.IO
│   │   ├── validation.js            # zod request-body schemas
│   │   ├── rag_store.js
│   │   ├── mcp_server.js
│   │   ├── agent.js
│   │   ├── realtime.js              # Socket.IO server + Redis pub/sub adapter, auth'd
│   │   ├── server.js
│   │   ├── routes/                  # /api/auth, /api/validate, /api/rules, /api/ask
│   │   └── data/
│   │       ├── sample_feed.json / sample_invoice_feed.json
│   │       └── knowledge_base/
│   ├── scripts/build-kb.js
│   └── tests/
│       ├── ...                      # 58 Jest tests, ~82% statement coverage
│       └── robot/                   # 10 Robot Framework API tests
│           ├── api_tests.robot
│           └── sample_feed.json
└── frontend/
    └── src/
        ├── App.jsx
        ├── authClient.js             # token storage
        ├── components/
        │   ├── LoginGate.jsx
        │   ├── Dashboard.jsx
        │   ├── ManifestStrip.jsx
        │   ├── FailureTable.jsx
        │   ├── RulesView.jsx
        │   └── AgentChat.jsx
        ├── styles/index.css
        └── *.test.js(x)              # 35 Vitest + Testing Library tests
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
cp .env.example .env
# Fill in JWT_SECRET (any random string locally) and API_KEYS, e.g.:
#   API_KEYS=demo:sk_demo_local
npm install
npm run dev                 # http://localhost:4000

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Open the app, sign in with the API key you set (e.g. `sk_demo_local`), and you're in.

To run the invoice-validation demo instead of the product-feed demo:

```bash
ACTIVE_ENGINE=invoice npm run dev
```

### With Docker Compose

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
API_KEYS=demo:sk_demo_local \
ANTHROPIC_API_KEY=sk-ant-... \
docker compose up --build
# frontend: http://localhost:8080, backend: http://localhost:4000, redis: internal only
```

Compose brings up a `redis` service alongside `backend`/`frontend` and waits on its
healthcheck before starting the backend. `JWT_SECRET` is required — compose fails fast with a
clear message if it's unset (see `docker-compose.yml`).

### As a standalone MCP server

```bash
cd backend && npm run mcp
```

## Real-time validation progress

Uploading a feed used to be a single request/response: the client sent all records, waited, and got one summary back. For large feeds that means a long silent spinner with no feedback.

`POST /api/validate` now accepts an optional `jobId`. When one is present:

1. The frontend generates a `jobId` (`crypto.randomUUID()`), opens an authenticated Socket.IO
   connection (the JWT from login is passed as `auth: { token }` on connect), and joins a
   room for that id *before* sending the POST.
2. As the active engine scores each record, the route batches results (5 at a time, or on
   the last record) and emits a `validation:progress` event to that room.
3. On completion, a `validation:complete` event fires with the final counts, and the HTTP
   response resolves with the full summary as before.

**Why Redis, not just Socket.IO on its own:** a bare Socket.IO server keeps its rooms in local process memory. That's fine for one backend instance, but the moment you run more than one (which is the normal way to scale a Node service — more processes, not a bigger one), a client connected to instance A never sees an event emitted by instance B, even if they're both handling requests for the same `jobId`. `@socket.io/redis-adapter` fixes that: every instance publishes emitted events to Redis, every instance's clients receive them regardless of which process they're actually connected to.

**Why rooms are `${tenantId}:${jobId}`, not just `${jobId}`:** jobIds are unguessable UUIDs,
so this isn't the only thing preventing cross-tenant eavesdropping — but tenant isolation
shouldn't rely on UUID entropy alone. Prefixing the room name is a second, independent
guarantee. See [SECURITY.md](./SECURITY.md) for the full writeup, including a data-isolation
bug this same scoping fixed elsewhere in the app.

**Why this degrades safely, not silently breaks:** `realtime.js` is only initialized when the server actually starts listening (`server.js`, guarded by `require.main === module`), never when something just does `require('./server')` — which is exactly what Jest/Supertest do to test the Express `app` in isolation. If Redis is unreachable, `initRealtime()` rejects, `server.js` logs it and keeps serving plain HTTP/REST, and `routes/validate.js` treats a `null` Socket.IO instance as "no live listeners" — the response shape and status codes are identical either way. Every existing test in the suite runs with zero knowledge that Socket.IO/Redis exist at all.

## Testing and linting

```bash
# Backend
cd backend && npm test    # 58 Jest tests, mocked LLM loop, no API key or Redis needed
cd backend && npm run lint

# Frontend
cd frontend && npm test   # 35 Vitest + Testing Library tests
cd frontend && npm run lint
cd frontend && npm run build
```

Both suites run fully offline in CI (mocked `@anthropic-ai/sdk` and mocked `api.js`). The
Jest suite includes a dedicated regression test for the tenant-isolation fix
(`tests/runs_route.test.js`) and coverage of the engine dispatcher
(`tests/engine_switch.test.js`) — the real-time layer itself is exercised manually/in Docker
Compose rather than in the unit suite, per the note above.

### API tests (Robot Framework)

Separate suite that calls the real, running API — no mocks. Catches issues unit tests can't, like wrong request/response shapes, and is the only suite that exercises the actual auth handshake end-to-end (token request → protected route) rather than a signed-in-code test token.

```bash
# with the backend running (npm run dev) and API_KEYS including
# demo:sk_demo_ci (or override --variable API_KEY:... to match your own)
cd backend/tests/robot
pip install robotframework robotframework-requests
robot api_tests.robot
```

Covers the full auth flow (token issuance, missing-token and invalid-token rejection), `/api/validate`, `/api/rules`, `/api/ask`, including error cases (missing title, unsupported currency, malformed body). Generates `report.html` with pass/fail results.

## CI/CD (`.gitlab-ci.yml`)

| Stage    | What happens |
|----------|--------------|
| `lint`   | ESLint on backend + frontend |
| `test`   | Jest, Robot Framework API tests, Vitest, Vite build check |
| `build`  | On `main`/tag: builds and pushes Docker images to the GitLab registry |
| `deploy` | `staging` auto-deploys on `main`; `production` is manual, tag-triggered |

`deploy` jobs are placeholders (`echo` statements) — swap in an AWS ECS/Lambda deploy step,
an UpCloud API call, or `kubectl apply`/`helm upgrade` for your infra. In CI, set
`JWT_SECRET` and `API_KEYS` as protected pipeline variables, never committed.

## Using it for a different kind of data

The `product` and `invoice` engines already show the pattern end-to-end:

1. Add a new file under `src/engines/` exporting the same shape: `{ validateFeed,
   validateRecord, getRuleDocs, rules, ...domain constants }` (keep the `{ ruleId, field,
   message, severity }` failure shape).
2. Register it in `src/engines/index.js`.
3. Run `ACTIVE_ENGINE=your-new-engine node scripts/build-kb.js` to rebuild the knowledge base
   doc for that domain.
4. Everything else — auth, routes, search, MCP server, agent, real-time layer, React UI —
   works unchanged.

## Security

See [SECURITY.md](./SECURITY.md) for the threat model, what auth/isolation/rate-limiting
protects against, and what's explicitly out of scope for a portfolio project versus a real
production deployment.
