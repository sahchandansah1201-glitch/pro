# Stage 6A — Production acceptance baseline

Stage 6A creates the first single acceptance baseline for Dermatolog Pro as a
deployable product. It does not introduce a new runtime API. It records the
evidence that the existing frontend, backend, PostgreSQL persistence, object
storage, nginx gateway, Device Bridge worker, operations tooling, patient
portal, and external adapter handoff now behave as one operator-owned system.

## Scope

- Add `deploy/self-hosted/acceptance-baseline.stage6a.json`.
- Add `scripts/stage6a-production-acceptance-baseline.mjs`.
- Generate:
  - `stage6a-production-acceptance-baseline.md`
  - `stage6a-production-acceptance-baseline.json`
- Add guard, unit tests, workflow, and `preflight-all` wiring.
- Preserve the existing product code paths; Stage 6A is an acceptance layer.

## Product boundary

- Deployment model: single self-hosted product.
- Frontend: static React build served by nginx.
- Backend: local Node API.
- Database: operator-owned PostgreSQL.
- Object storage: operator-owned object storage or local filesystem volume.
- Worker: operator-owned Device Bridge worker.
- Managed runtime/database dependency: none.
- Product runtime does not call CRM, advertising, or external scheduling
  systems. Those adapters remain operator-owned processes outside the product
  runtime.
- Production mode must not fall back to demo data.

## Local usage

```bash
npm run acceptance:stage6a:report
npm run preflight:stage6a
```

The report command writes acceptance evidence into `test-results/` and prints a
Markdown summary suitable for release notes or a deployment review.

## Acceptance domains

Stage 6A checks evidence for:

- deployable stack;
- production mode cutover;
- auth and RBAC;
- patient and clinical workspace;
- clinical assets;
- doctor dashboard and visit schedule;
- leads, appointments, and operator intake;
- patient portal;
- external adapter flow;
- ops/readiness;
- Device Bridge.

## Release gate

`npm run preflight:stage6a` runs:

1. Stage 6A unit tests.
2. Stage 6A guard.
3. The acceptance report generator.
4. `node scripts/check-no-deno-locks.mjs`.

The generated report marks the baseline accepted only when all evidence files
exist, Stage 6A scripts are wired, `package-lock.json` is unchanged, no
`deno.lock` files are present, and the report has no privacy leak findings.

## Stage 6B handoff

When Stage 6A is accepted, the next stage is Stage 6B: server install package.
Stage 6B should use this baseline as the required input before producing the
server-facing installation bundle.
