# Stage 5B - Production server bootstrap

Stage 5B turns the Stage 5A release candidate into a first-server bootstrap
flow. The goal is to verify that a single operator-owned server can run
Dermatolog Pro without a managed runtime, managed database, external auth
provider, or browser hardware API dependency.

Boundary:

- frontend: static bundle served by nginx;
- backend: self-hosted Node process;
- database: operator-owned PostgreSQL;
- object storage: operator-owned object storage or local filesystem volume;
- worker: local Device Bridge worker;
- managed runtime: none;
- managed database: none.

## Commands

```bash
npm run preflight:stage5b
npm run bootstrap:stage5b:dry-run
npm run bootstrap:stage5b:verify-env:example
```

`bootstrap:stage5b:dry-run` prints the server bootstrap plan. It does not start
containers, apply SQL, print env values, print password hashes, or touch real
patient data.

`bootstrap:stage5b:verify-env:example` validates the checked-in Stage 5A env
template with placeholders allowed. On a real server, run:

```bash
node scripts/stage5b-server-bootstrap.mjs verify-env \
  --env-file deploy/self-hosted/.env.production
```

Placeholders are errors in real production env files.

## First system_admin

The first system_admin is created locally through generated SQL so the initial
operator account does not depend on any external identity provider.

Generate the first `system_admin` SQL on the server:

```bash
node scripts/stage5b-server-bootstrap.mjs admin-sql \
  --email admin@example.com \
  --display-name "System Administrator" \
  --password "<temporary-password>" \
  --output /secure/path/bootstrap-system-admin.sql
```

Then review and apply that SQL through the operator-owned PostgreSQL process.
The command writes the SQL file but does not print the password or scrypt hash
to stdout. Delete the generated SQL after the first admin logs in and rotates
the temporary password.

The checked-in
`deploy/self-hosted/bootstrap-system-admin.stage5b.sql.example` is a shape-only
template. Do not edit it with real credentials and do not commit generated SQL.

## Bootstrap checklist

1. Run `npm run preflight:stage5b`.
2. Replace every placeholder in `deploy/self-hosted/.env.production`.
3. Run real env validation with no `--allow-placeholders`.
4. Confirm Docker, Docker Compose, Node.js, and npm are available.
5. Confirm `APP_PORT` and `BACKEND_PORT` are free.
6. Confirm `BACKUP_ROOT` and `OBJECT_STORAGE_LOCAL_DIR` exist and are owned by
   the deployment user.
7. Run `npm run build`.
8. Validate compose config.
9. Start the production compose stack.
10. Generate/apply first `system_admin` SQL.
11. Verify `/healthz`, `/readyz`, `/api/v1/meta`, and product readiness.
12. Run Stage 4K smoke and Stage 4M backup/rollback plans.

## Production data rule

Stage 5B does not add a schema migration. It verifies the existing Stage 4A-4Z
PostgreSQL schema and separates production bootstrap from demo seed usage. Demo
seed rows remain useful for local smoke checks; production bootstrap must create
the first real admin explicitly through the Stage 5B SQL generation flow.

## Verification

```bash
npm run test:stage5b
npm run check:stage5b
npm run preflight:stage5b
```

The Stage 5B guard verifies CLI commands, env validation, first-admin SQL
template, docs, workflow, package scripts, `preflight:all` wiring, and the
self-hosted product boundary.
