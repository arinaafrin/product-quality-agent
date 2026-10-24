# Product Quality Agent

This app checks business records against a set of rules. It explains why a record failed, and you can ask it questions about the results.

It has two rule sets: an e-commerce product feed, and Finnish invoice records (VAT rates, invoice numbers, vendor IDs, duplicate and future-dated invoices).

Stack: Node.js/Express, React (Vite), Socket.IO with Redis, JWT auth, Docker, GitHub Actions.

## Features

- **Login.** You sign in with an API key and get a JWT. Every route needs the token. Each tenant only sees its own data. See [SECURITY.md](./SECURITY.md).
- **Two rule sets.** `ACTIVE_ENGINE` switches between `product` and `invoice`. No other code changes.
- **Agent.** `agent.js` answers questions with a tool-use loop (`search_knowledge_base`). It works with Anthropic or Azure OpenAI. With no key, or if a call fails, it answers from the knowledge base alone.
- **Search.** `rag_store.js` is a TF-IDF search over the rule docs and past runs. It needs no external database.
- **MCP server.** `mcp_server.js` gives the same tools to Claude Desktop, Claude Code or any MCP client.
- **Live progress.** Socket.IO and Redis send progress to the browser while a feed is validated.
- **Tests.** 61 Jest tests, 37 Vitest tests and 10 Robot Framework tests. GitHub Actions runs them, builds the Docker image, and runs a smoke test on the running container.

## Run it locally

You need Node 20, and Docker if you want Redis.

```bash
# Redis (optional, only needed for live progress)
docker run -p 6379:6379 redis:7-alpine

# Backend
cd backend
cp .env.example .env
# Set JWT_SECRET (any random text) and API_KEYS, for example:
#   API_KEYS=demo:sk_demo_local
npm install
npm run dev                 # http://localhost:4000
```

Open a second terminal in the project root:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Open the app and sign in with your API key (for example `sk_demo_local`).

To use the invoice rules, start the backend with `ACTIVE_ENGINE=invoice npm run dev`.

## Run it with Docker

One image holds the React build and the Express backend. Express serves the frontend, so you only need one container.

```bash
docker build -t pqa:local .
docker run -d --name pqa -p 4000:4000 \
  -e JWT_SECRET=local-secret -e API_KEYS=demo:sk_local \
  -e ALLOWED_ORIGINS=http://localhost:4000 pqa:local
```

Open http://localhost:4000 and sign in with `sk_local`.

Redis is optional. Without it the server still starts and the REST API works. The log shows Redis errors, and live progress works for one instance only.

You can also use Docker Compose (backend, nginx frontend and Redis):

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
API_KEYS=demo:sk_demo_local \
docker compose up --build
# frontend: http://localhost:8080, backend: http://localhost:4000
```

## LLM providers

Set `LLM_PROVIDER` to choose a provider.

| `LLM_PROVIDER` | Needs | Notes |
|---|---|---|
| `anthropic` (default when a key exists) | `ANTHROPIC_API_KEY` | Tool-use loop |
| `azure-openai` | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` | Same tool, same response |
| none | nothing | Answer from the knowledge base, no LLM |

`AZURE_OPENAI_API_VERSION` is optional (default `2024-10-21`). All variables are listed in `backend/.env.example`.

If a provider call fails, the agent logs the error and uses the offline answer. The response has a `mode` field (`llm` or `offline`). Azure OpenAI answers also have `provider`.

**Status:** the Azure OpenAI code is tested with a fake client in Jest. `infra/azure/mock-aoai.js` is a small fake server for manual tests. It has not been run against a real Azure OpenAI resource, and the app is not deployed to Azure.

## Tests

```bash
cd backend && npm test        # 61 Jest tests, no API key or Redis needed
cd backend && npm run lint

cd frontend && npm test       # 37 Vitest tests
cd frontend && npm run lint
cd frontend && npm run build
```

`npm test` uses `--runInBand` to keep memory use low. If Jest is slow or runs out of memory on your computer, run `npx jest --runInBand --coverage=false`.

**Robot Framework (API tests).** These call the real running API with no mocks. Start the backend or the Docker container first.

```bash
cd backend/tests/robot
pip install robotframework robotframework-requests
robot --variable BASE_URL:http://localhost:4000 --variable API_KEY:sk_local api_tests.robot
```

They cover login, missing and invalid tokens, `/api/validate`, `/api/rules` and `/api/ask`, including error cases. The token route allows 10 requests per 15 minutes, so restart the app if you run the suite many times.

**Smoke test.** This script sends real HTTP requests to a running app and checks nine things: health, frontend page, route without token (401), wrong API key (401), token, route with token, validating the sample feed, run history, and an agent answer. Run it from the project root. It needs `curl` and `jq`.

```bash
bash infra/azure/smoke-test.sh http://localhost:4000 sk_local
```

## CI

**GitHub Actions** (`.github/workflows/ci.yml`) runs on every push and pull request.

| Job | What it does |
|---|---|
| `backend` | `npm ci`, ESLint, Jest |
| `frontend` | `npm ci`, ESLint, Vitest, Vite build |
| `docker` | Builds the image, starts it, runs the smoke test and the Robot suite |

There is no deploy job. The app is not deployed to a cloud service.

**GitLab CI** (`.gitlab-ci.yml`) is also included. It has lint, test, build and deploy stages. The deploy jobs are placeholders (`echo` only). Set `JWT_SECRET` and `API_KEYS` as protected variables, and never commit them.

## Live progress

`POST /api/validate` accepts an optional `jobId`. With a `jobId`:

1. The browser opens a Socket.IO connection with its JWT and joins a room for that job.
2. The server sends a `validation:progress` event for every 5 records.
3. At the end it sends `validation:complete`, and the HTTP response returns the full summary.

Redis lets several backend instances share events, so a client gets progress from any instance. Rooms are named `tenantId:jobId`, so one tenant cannot listen to another tenant's job.

If Redis is not reachable, the server logs the error and keeps serving REST. The response is the same either way. The live progress layer is tested by hand and in Docker Compose, not in the unit tests.

## Project structure

```
product-quality-agent/
├── Dockerfile                # one image: React build + Express
├── docker-compose.yml        # backend, nginx frontend, Redis
├── .github/workflows/ci.yml  # GitHub Actions
├── .gitlab-ci.yml            # GitLab pipeline
├── SECURITY.md
├── CHANGELOG.md
├── infra/azure/
│   ├── smoke-test.sh         # HTTP checks for a running app
│   └── mock-aoai.js          # fake Azure OpenAI server
├── backend/
│   ├── src/
│   │   ├── engines/          # product and invoice rules
│   │   ├── providers/azure_openai.js
│   │   ├── agent.js          # provider switch and offline fallback
│   │   ├── mcp_server.js     # MCP server over stdio
│   │   ├── rag_store.js      # TF-IDF search
│   │   ├── auth.js           # JWT and requireAuth
│   │   ├── realtime.js       # Socket.IO and Redis
│   │   ├── routes/           # /api/auth, /api/validate, /api/rules, /api/ask
│   │   └── data/             # sample feeds and knowledge base
│   ├── scripts/build-kb.js
│   └── tests/                # Jest tests and robot/ suite
└── frontend/src/             # React app and Vitest tests
```

`mcp_server.js` is for outside MCP clients. `agent.js` runs the chat in the app. Both use the same `rag_store.js`.

## Add a new kind of data

1. Add a file in `backend/src/engines/` with the same exports as the existing engines: `validateFeed`, `validateRecord`, `getRuleDocs`, `rules`. Keep the failure shape `{ ruleId, field, message, severity }`.
2. Register it in `backend/src/engines/index.js`.
3. Run `ACTIVE_ENGINE=your-engine node scripts/build-kb.js` to rebuild the knowledge base.

Auth, routes, search, MCP, the agent and the UI work without other changes.

## Security

See [SECURITY.md](./SECURITY.md) for the threat model and what is out of scope for a portfolio project.