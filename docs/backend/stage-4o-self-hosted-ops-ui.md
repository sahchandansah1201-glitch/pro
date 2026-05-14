# Stage 4O - Self-hosted ops UI

## 1. Scope

Stage 4O adds the first production-facing operations screen inside the
frontend shell for the self-hosted product. The page lives at
`/sys/self-hosted-ops` and is available only through the existing `/sys`
system administrator route guard.

The page reads the self-hosted backend status endpoint:

```bash
GET /api/v1/ops/status
```

It does not introduce any external managed runtime dependency. The
database remains the project-owned PostgreSQL instance from
`deploy/self-hosted`, and the UI only talks to the backend API selected by
the local self-hosted session.

## 2. Product Boundary

The intended deployment remains a single server-owned product:

- frontend served by the self-hosted gateway;
- backend served by `backend/self-hosted`;
- PostgreSQL and object storage owned by the deployment;
- no externally controlled database service is required for runtime;
- no frontend direct database access is introduced.

If a managed service becomes unavailable or changes policy, Stage 4O must
not affect the operational product because it depends only on the
self-hosted API surface.

## 3. UI Behavior

The page shows:

- backend readiness summary;
- dependency table for PostgreSQL, object storage, and audit export status;
- correlation-id and audit-retention hints;
- a safe dry-run preview for the Stage 4N audit export command;
- an explicit notice when no self-hosted session is configured;
- a role warning when the current self-hosted user is not `system_admin`.

The page never renders raw tokens, object keys, storage paths, patient
names, signed URLs, cookies, or authorization headers.

## 4. Frontend Contract

The frontend client is `src/lib/self-hosted-ops-api.ts`.

It calls `/api/v1/ops/status` through the same local base URL and bearer
token storage used by the Stage 4E-4J self-hosted adapters. The response is
normalized before rendering, so unknown backend fields are ignored.

The route is registered in `src/App.tsx`:

```tsx
<Route path="/sys/self-hosted-ops" element={<SysSelfHostedOpsPage />} />
```

The sidebar entry is in `src/components/shell/AppSidebar.tsx` under the
system administrator group.

## 5. Verification

Run the focused Stage 4O gate:

```bash
npm run preflight:stage4o
```

For browser coverage:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
npm run e2e:stage4o
```

The CI workflow starts Vite before running the Playwright spec. Local
runs need the same Vite server unless another process is already serving
the app at `http://localhost:8080`.

Stage 4O is also included in the deterministic local/CI gate:

```bash
npm run preflight:all
```

## 6. CI

`.github/workflows/stage4o-self-hosted-ops-ui.yml` runs:

- `npm run preflight:stage4o`;
- `npm run e2e:stage4o`;
- a GitHub Actions summary explaining the checked self-hosted boundary.

The e2e test mocks `/api/v1/ops/status`; CI does not connect to a live
production server.

## 7. Guardrails

`scripts/check-stage4o-self-hosted-ops-ui.mjs` verifies:

- required UI, client, e2e, docs, workflow, and guard files exist;
- `package.json` includes `test:stage4o`, `check:stage4o`,
  `preflight:stage4o`, and `e2e:stage4o`;
- `scripts/preflight-all.mjs` includes
  `Stage 4O self-hosted ops UI preflight`;
- protected runtime files do not reference managed-runtime tokens such as
  `api-read`, `api-write`, edge functions, or managed database env names.

The guard intentionally allows ordinary local databases. The restriction
is about third-party runtime control, not about using a database at all.
