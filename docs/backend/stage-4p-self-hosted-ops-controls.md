# Stage 4P - Self-hosted ops controls

## 1. Scope

Stage 4P turns `/sys/self-hosted-ops` from a passive status page into a
server-owned operations panel. It adds:

- backend endpoint `GET /api/v1/ops/runtime-checks`;
- runtime checks for PostgreSQL connectivity, backend-owned object storage,
  migration bundle presence, and dry-run operations commands;
- frontend sections for `Self-hosted runtime checks` and
  `Self-hosted operations dry-runs`;
- a downloadable operations preview with backup, restore, deploy-smoke, and
  audit-export dry-run commands;
- OpenAPI contract `/openapi.stage4p.json`;
- guard, workflow, docs, e2e, and `preflight:stage4p`.

## 2. Product Boundary

Stage 4P keeps the target architecture as one deployable product:

- frontend served by the self-hosted gateway;
- backend served by `backend/self-hosted`;
- PostgreSQL owned by the deployment;
- object storage owned by the deployment and reachable only through backend
  contracts;
- backup, restore, audit export, and deploy smoke as local/server operator
  commands.

External managed databases or cloud functions are not required for runtime.
The UI does not talk to a database directly. It calls the backend API, and
the backend performs checks against server-owned resources.

## 3. Backend Contract

Endpoint:

```bash
GET /api/v1/ops/runtime-checks
```

Access:

- bearer token required;
- `system_admin` only, via the same RBAC path as `/api/v1/ops/status`;
- audit action `ops.runtime_checks.read`.

Safe response fields:

- `checks[]`: key, label, status, detail, non-sensitive counts or percentages;
- `commands[]`: dry-run command, label, description, status;
- `generatedAt`, `correlationId`, and normalized auth role list.

Forbidden in responses:

- request bodies;
- tokens, cookies, passwords, raw env values;
- patient names;
- object keys or storage paths;
- signed URLs.

## 4. Runtime Checks

Current checks:

- `postgres_connectivity`: calls backend database client `checkConnection()`.
- `object_storage_runtime`: verifies configured backend-owned object storage
  mode. Local filesystem mode checks writability and disk usage without
  rendering local paths.
- `migration_bundle`: confirms the self-hosted PostgreSQL migration bundle is
  present in `backend/self-hosted/db/migrations`.

Current dry-run commands:

```bash
npm run ops:stage4l:backup:dry-run
npm run ops:stage4l:restore:dry-run
npm run smoke:stage4k:dry-run
npm run ops:stage4n:audit-export:dry-run
```

These commands remain operator-controlled. The browser shows the plan; it
does not execute destructive operations.

## 5. Frontend

`src/pages/sys/SysSelfHostedOpsPage.tsx` now loads:

- `/api/v1/ops/status`;
- `/api/v1/ops/runtime-checks`.

The page renders:

- readiness dependencies;
- observability contract;
- runtime operations checks;
- operations dry-runs;
- audit export dry-run preview.

The route remains `/sys/self-hosted-ops`, behind the existing `system_admin`
route guard.

## 6. Verification

Focused gate:

```bash
npm run preflight:stage4p
```

Browser coverage:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
npm run e2e:stage4p
```

Stage 4P is included in:

```bash
npm run preflight:all
```

## 7. CI

`.github/workflows/stage4p-self-hosted-ops-controls.yml` runs:

- `npm run preflight:stage4p`;
- `npm run e2e:stage4p`;
- a GitHub Actions summary describing the self-hosted boundary.

The e2e spec mocks `/api/v1/ops/status` and
`/api/v1/ops/runtime-checks`; CI does not connect to a live production
server.

## 8. Guardrails

`scripts/check-stage4p-self-hosted-ops-controls.mjs` verifies:

- required backend, frontend, e2e, docs, workflow, and guard files exist;
- package scripts `test:stage4p`, `check:stage4p`, `preflight:stage4p`,
  and `e2e:stage4p`;
- `preflight-all` includes `Stage 4P self-hosted ops controls preflight`;
- protected runtime files do not reference managed-runtime tokens.

This guard blocks third-party runtime coupling. It does not block local
PostgreSQL or local object storage, because those are part of the
self-hosted product.
