# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] — Security, multi-tenant auth & pluggable domains

This release closes every gap identified in a security review of the previous version:
unauthenticated routes, a cross-tenant data leak in validation history, open CORS, and no
rate limiting. It also finishes wiring the invoice-validation engine into the app behind a
runtime domain switch. See [SECURITY.md](./SECURITY.md) for the full threat-model writeup.

### Added
- **Authentication.** `POST /api/auth/token` exchanges a pre-provisioned API key for a
  short-lived JWT (`src/auth.js`, `src/routes/auth.js`). Every other route now requires it
  via `requireAuth` middleware. The token endpoint has its own, stricter rate limit to resist
  brute-forcing.
- **Per-tenant data isolation.** Validation run history is now scoped by the tenant ID
  carried in the caller's JWT, everywhere it's stored or read.
- **Socket.IO authentication.** WebSocket connections require the same JWT on handshake;
  real-time rooms are namespaced `${tenantId}:${jobId}` instead of just `${jobId}`.
- **Request validation.** `src/validation.js` (zod) bounds `/api/validate` payload size and
  `/api/ask` question length, returning structured 400s with field-level issues.
- **Security headers & rate limiting.** `helmet()` applied globally; `express-rate-limit` on
  general API traffic and, more tightly, on the auth endpoint.
- **Pluggable validation engines.** `src/engines/` holds `product` and `invoice` rule
  engines behind a common interface, selected at runtime via `ACTIVE_ENGINE`. The invoice
  engine validates Finnish VAT rates (0/10/14/25.5%), invoice number format, vendor ID,
  duplicate invoice numbers, and future-dated invoices.
- **`SECURITY.md`** — threat model and a full writeup of what changed and why.
- Frontend login gate (`LoginGate.jsx`), token storage (`authClient.js`), and sign-out.
- Sample invoice feed data (`sample_invoice_feed.json` / `.csv`) exercising every invoice
  rule.
- Regression tests: cross-tenant isolation (`runs_route.test.js`), the engine dispatcher
  (`engine_switch.test.js`), and the full auth flow (`auth.test.js`).
- Robot Framework suite now authenticates for real before exercising the API, plus new
  negative tests for missing/invalid tokens.

### Changed
- `src/quality_engine.js` is now a thin dispatcher over the active engine rather than the
  product rules directly — every existing call site (`routes/validate.js`,
  `mcp_server.js`, `scripts/build-kb.js`) is unaffected.
- `scripts/build-kb.js` generates its knowledge-base doc from whichever engine is active.
- CORS replaced with an explicit `ALLOWED_ORIGINS` allowlist (was open to any origin),
  applied identically to REST and Socket.IO.
- `docker-compose.yml` requires `JWT_SECRET` to be set (fails fast rather than starting
  insecurely) and passes through the new auth/CORS env vars.
- `.gitlab-ci.yml` test jobs now provide `JWT_SECRET` / `API_KEYS` / `ALLOWED_ORIGINS` so
  the Jest and Robot Framework suites run authenticated in CI.
- `README.md` rewritten to document auth, the engine switch, and corrected test counts.

### Fixed
- **Cross-tenant data leak**: `GET /api/runs` used to return every caller's validation
  history from one shared in-memory array, regardless of who asked. Any client could read
  any other client's data. Now scoped per authenticated tenant.
- **Open CORS**: `cors()` with no options reflected any `Origin` header. Now an explicit
  allowlist.
- **Unauthenticated WebSocket rooms**: any client could join any `jobId` room. Now requires
  auth and is tenant-namespaced.
- Frontend production build was broken (`isAuthenticated` was used by `App.jsx` but never
  re-exported from `api.js`) — caught by `npm run build`, not by the unit test suite; fixed
  and the build step is now part of the verification process for future changes.

### Security
No known secrets were ever committed (`.env` was empty and correctly gitignored throughout
this work). Generated Robot Framework reports (`output.xml`, `log.html`, `report.html`) were
previously committed to the repo; they're now gitignored and removed from tracking.
