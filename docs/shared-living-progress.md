# Shared Living continuation

Verification resumed on 2026-09-08 from the existing local implementation. No
deployment, push or pull request was performed.

The continuation added request-id idempotency for shared financial writes,
direct payer balance accounting, per-user group/month restoration, safer viewer
UI states and keyboard semantics, and an isolated E2E environment. Migration
`0012_shared_living_requests.sql` adds request metadata, uniqueness and indexes.
The demo seed now supplies the required finance mode for expense and income
rows.

Validation completed:

- Unit: 205 passed. Web/UI: 220 passed.
- API E2E: 208 passed; Settings: 76; Debts: 107; Refresh: 15.
- Shared Living API journey: 10 passed. Shared Living database: 14 passed.
- Database constraints: 27 passed; debt transactions: 16 passed.
- Fresh-schema migrations, boundaries, shadowing, dead-code checks and the
  production build passed.
- Security suites passed with `NODE_ENV=test` against the isolated test API
  (54 pentest checks, 22 surface/storage checks).
- Playwright Shared Living browser journey passed twice from clean API/Vite
  process pairs and clean schemas (desktop English journey, 1m36s each).

The Neon pooler rejected startup `search_path` options, so the local E2E
launcher uses the direct endpoint and a unique schema (`hw_e2e_<16 hex>`).
The browser suite exposed and fixed a real `ProtectedRoute` translation crash
(`t is not defined`), an onboarding initialization order bug, and an auth
restore race where a late failed refresh cleared a successful login. The test
also now waits for the application’s authenticated onboarding redirect instead
of manually racing it with navigation.

The existing unrelated C++ scratch files were left untouched.
