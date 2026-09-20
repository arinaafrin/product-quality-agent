# Security

This document covers the security-relevant design of the Product Quality Agent: what's
protected, what isn't, why the current boundaries were chosen, and what a real production
deployment would still need on top of this. Written as part of applying the coursework from
*Privacy and Security for Software Systems* (University of Turku, cross-institutional) to a
real codebase rather than a classroom exercise.

## Threat model

This app validates structured business records (product feed items, or invoice/accounting
records when `ACTIVE_ENGINE=invoice` — see the README) on behalf of a caller, stores a short
rolling history of past validation runs, and answers natural-language questions about that
history via retrieval + an optional LLM call.

Assumed adversary: an unauthenticated network attacker, and — separately — an authenticated
caller belonging to one tenant trying to access another tenant's data. Not in scope: a
compromised backend host, a malicious npm dependency, or physical access to the server.

## What changed, and what it fixes

### 1. Cross-tenant data leak (the main finding)

**Before:** validation run history was a single array in server memory
(`const runHistory = []`), shared by every caller regardless of who they were. Any client
that could reach `GET /api/runs` saw every other client's validation runs — for an
invoice-validation deployment, that's every tenant's accounting data.

**After:** history is a `Map<tenantId, runs[]>` (`routes/validate.js`), and `tenantId` comes
only from a verified JWT claim, never from client input. `tests/runs_route.test.js` includes
a regression test (`SECURITY: one tenant cannot see another tenant's validation runs`) that
fails against the old code and passes against the new code.

### 2. No authentication

**Before:** every route was open to anyone who could reach the server.

**After:** `POST /api/auth/token` exchanges a pre-provisioned API key for a short-lived
(15 min default) JWT. `requireAuth` middleware (`src/auth.js`) protects every other route.
API keys are configured via the `API_KEYS` environment variable
(`tenantId:apiKey` pairs) — no user database, since this is a demo of the *pattern*, not a
full identity system. A real production deployment would put this behind a proper
credential store (hashed keys at rest, rotation, per-key scopes) rather than a plaintext env
var.

The token endpoint has its own, much stricter rate limit (`routes/auth.js`) than the general
API, since it's the one endpoint an attacker would target to brute-force a key.

### 3. Open CORS

**Before:** `app.use(cors())` with no options reflects any `Origin` header — equivalent to
allowing every website on the internet to call the API from a user's browser.

**After:** an explicit allowlist via `ALLOWED_ORIGINS` (`src/corsConfig.js`), applied
identically to both the REST API and the Socket.IO handshake. Requests with no `Origin`
header (curl, server-to-server, the test suite) are still allowed, since CORS is a
browser-enforced mechanism and doesn't apply to those callers anyway.

### 4. Unauthenticated, unscoped WebSocket connections

**Before:** any Socket.IO client could connect, and could join a `jobId` room for any job —
in practice hard to exploit since `jobId` is a random UUID, but nothing enforced it.

**After:** the Socket.IO handshake requires the same JWT as REST calls (`src/realtime.js`),
and rooms are named `${tenantId}:${jobId}` rather than just `${jobId}` — defense in depth on
top of UUID unguessability, not a replacement for it.

### 5. No input validation beyond ad-hoc checks

**Before:** `POST /api/validate` checked `Array.isArray(records)` and little else — an
attacker could send an unbounded array and tie up the server, or send records shaped nothing
like the schema.

**After:** `src/validation.js` uses `zod` to bound array size (max 5,000 records) and
constrain the `ask` endpoint's question length, returning a structured 400 with field-level
issues on failure.

### 6. Missing security headers / no rate limiting

**Before:** neither `helmet` nor any rate limiter was present.

**After:** `helmet()` is applied globally; `express-rate-limit` caps general API traffic and,
separately and more tightly, the token endpoint.

## What's still out of scope

This is a portfolio project, not a compliance-audited production system. Explicitly not
done, and what a real deployment would add:

- **Secrets management** — `.env` works for local dev; a real deployment should use AWS
  Secrets Manager (or equivalent) for `JWT_SECRET`, `API_KEYS`, and `ANTHROPIC_API_KEY`
  rather than environment variables sourced from a file.
- **Key rotation and revocation** — API keys here are static until someone edits the env var.
  No expiry, no per-key revocation list.
- **Audit logging** — no record of who validated what, when, beyond the in-memory run
  history itself (which is not persisted across restarts).
- **Encryption at rest** — there's no database in this project; if `runHistoryByTenant` were
  moved to persistent storage, that storage would need its own encryption and access
  controls.
- **Dependency scanning** — no automated `npm audit` / Dependabot-equivalent wired into CI
  yet.

## Reporting

This is a personal portfolio project, not a maintained public service — there's no formal
disclosure process. If you find something, feel free to open an issue.
