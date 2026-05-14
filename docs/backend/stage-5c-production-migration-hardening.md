# Stage 5C - Production migration hardening

Stage 5C hardens first install and upgrade install around the operator-owned
PostgreSQL database. Stage 5A packaged the release candidate, Stage 5B added
server bootstrap, and Stage 5C verifies that the production database is in a
safe schema/bootstrap state before real clinical use.

Boundary:

- managed runtime: none;
- managed database: none;
- database: operator-owned PostgreSQL;
- checked-in demo/smoke seed files are not production bootstrap inputs.

## Commands

```bash
npm run preflight:stage5c
npm run migrate:stage5c:dry-run
npm run migrate:stage5c:schema-sql
npm run migrate:stage5c:seed-policy
```

`migrate:stage5c:dry-run` renders the migration inventory and production seed
policy. `migrate:stage5c:schema-sql` writes
`test-results/stage5c-prestart-schema-check.sql`, which can be copied to the
server and run against the operator-owned PostgreSQL database.

## Production seed policy

The production seed policy is strict: demo and smoke seed files are excluded
from server bootstrap for real clinical deployments.

These files are excluded from production bootstrap:

- `0002_stage4b_runtime_seed.sql`
- `0003_stage4c_auth_seed.sql`
- `0007_stage4k_deploy_smoke_seed.sql`

They remain useful for local smoke checks only. Production bootstrap must use
Stage 5B generated first-admin SQL instead of checked-in demo credentials.

## Pre-start schema check

The generated Stage 5C SQL verifies:

- required tables exist;
- required `app_role` enum values exist;
- `audit_log_no_update` append-only trigger exists;
- demo doctor auth seed is absent;
- at least one `system_admin` role exists.

The checked-in `deploy/self-hosted/prestart-schema-check.stage5c.sql` is a
shape-only template. Generate a fresh copy during deployment:

```bash
node scripts/stage5c-production-migration-hardening.mjs schema-sql \
  --output /secure/path/prestart-schema-check.sql
```

## Fresh install vs upgrade install

Fresh install:

1. Apply schema migrations only.
2. Do not apply demo/smoke seed files.
3. Generate/apply first `system_admin` SQL through Stage 5B.
4. Run the Stage 5C pre-start schema check.
5. Run Stage 4K smoke and Stage 4M backup/rollback plans.

Upgrade install:

1. Take a backup first.
2. Apply new schema migrations in lexical order.
3. Do not reapply demo/smoke seed files.
4. Run the Stage 5C pre-start schema check.
5. Run post-deploy smoke and rollback-drill plans.

## Verification

```bash
npm run test:stage5c
npm run check:stage5c
npm run preflight:stage5c
```

The Stage 5C guard verifies migration inventory tooling, production seed
policy, pre-start SQL template, docs, workflow, package scripts,
`preflight:all` wiring, and the self-hosted product boundary.
