# Stage 6B — Server install package

Stage 6B turns the accepted Stage 6A product baseline into an operator-facing
server install package. It does not introduce a new runtime API, database
schema, frontend route, or browser hardware integration. The package is a local
install plan and inventory for deploying Dermatolog Pro as one self-hosted
product on an operator-owned server.

## Scope

- Add `deploy/self-hosted/server-install-package.stage6b.json`.
- Add `scripts/stage6b-server-install-package.mjs`.
- Generate:
  - `stage6b-server-install-package.md`
  - `stage6b-server-install-package.json`
- Add guard, unit tests, workflow, and `preflight-all` wiring.
- Require Stage 6A to be accepted before the install package is marked ready.

## Package boundary

- Managed runtime/database dependency: none.
- Product runtime does not call external CRM, advertising, or scheduling
  systems.
- Production mode must not fall back to demo data.
- The package contains file paths, commands, and checklist labels only.
- Production environment values and first system admin SQL are created on the
  target server and kept outside git.
- Patient records, object keys, credentials, external adapter payloads, and
  signed links are not included.

## Included install inputs

Stage 6B checks that the server install package has the required local inputs:

- Stage 6A acceptance baseline.
- Docker Compose base stack and production overlay.
- Nginx gateway config.
- Production environment template.
- Backend Dockerfile and API entrypoint.
- PostgreSQL migration directory and prestart schema check.
- Device Bridge worker runtime, systemd unit, and environment template.
- First system admin bootstrap SQL template.

## Local usage

```bash
npm run install:stage6b:report
npm run install:stage6b:dry-run
npm run preflight:stage6b
```

The report command writes install evidence into `test-results/` and prints a
Markdown summary suitable for deployment review.

## Release gate

`npm run preflight:stage6b` runs:

1. Stage 6B unit tests.
2. Stage 6B guard.
3. The server install package report generator.
4. `node scripts/check-no-deno-locks.mjs`.

The generated report is ready only when Stage 6A is accepted, all required
install inputs exist, package scripts are wired, safety assertions are green,
and the report has no privacy leak findings.

## Operator handoff

The server operator should complete `deploy/self-hosted/.env.production` on the
server, validate it, build the frontend, validate Compose, start the stack,
bootstrap the first system admin outside git, then run first-boot, smoke,
backup, and rollback checks.
