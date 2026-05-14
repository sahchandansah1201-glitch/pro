# Stage 5A - Self-hosted release candidate

Stage 5A starts the release-candidate line for Dermatolog Pro as one
server-owned product. The candidate consists of the static frontend, the
self-hosted Node backend, operator-owned PostgreSQL, operator-owned object
storage or local filesystem storage, and the local Device Bridge worker.

The target boundary is explicit:

- managed runtime: none;
- managed database: none;
- browser hardware APIs from UI: false;
- clinical data and object bytes stay inside the operator-owned deployment.

## Release candidate command

```bash
npm run preflight:stage5a
npm run release:stage5a:dry-run
```

`release:stage5a:dry-run` renders a safe release candidate manifest. It lists
required files, PostgreSQL migration order, release gates, and the server
install outline. It does not print passwords, bearer tokens, raw env values,
patient names, object keys, object paths, or signed URLs.

## Environment template

Use `deploy/self-hosted/release-candidate.stage5a.env.example` as the canonical
server inventory template for this stage.

Required operator-owned services:

- PostgreSQL via `DATABASE_URL`;
- object storage through `OBJECT_STORAGE_LOCAL_DIR` or private
  `OBJECT_STORAGE_ENDPOINT`;
- backend JWT signing through `JWT_SECRET`;
- local Device Bridge worker token through `DEVICE_BRIDGE_WORKER_TOKEN`;
- frontend API default through `VITE_SELF_HOSTED_API_BASE_URL`.

The template includes `THIRD_PARTY_MANAGED_SERVICES_REQUIRED=false` to keep the
release boundary visible during review.

## Migration order

Apply `backend/self-hosted/db/migrations/*.sql` in lexical order on a fresh
operator-owned PostgreSQL database. Stage 5A does not introduce a new schema
migration; it packages the Stage 4A-4Z schema as the first release candidate.

Current migration range:

- `0001_stage4a_core.sql`
- `0013_stage4x_device_bridge_audit_replay.sql`

## Release gates

Run these before promoting a server build:

```bash
npm run preflight:stage5a
npm run preflight:stage4z
npm run preflight:all
npm run build
npm run smoke:stage4k
npm run deploy:stage4m:post-deploy:dry-run
npm run deploy:stage4m:backup-after-deploy:dry-run
npm run deploy:stage4m:rollback-drill:dry-run
```

Expected:

- all commands exit 0;
- `node scripts/check-no-deno-locks.mjs` stays green;
- `package-lock.json` is unchanged unless dependency changes are intentional;
- product readiness reports `Managed runtime: none` and
  `Managed database: none`;
- backup and rollback drills are planned before real patient data enters the
  deployment.

## Server install outline

1. Copy `deploy/self-hosted/release-candidate.stage5a.env.example` into the
   server inventory and replace every placeholder.
2. Copy the production values into `deploy/self-hosted/.env.production`.
3. Build the frontend with `npm run build`.
4. Start the stack with:

   ```bash
   docker compose --env-file deploy/self-hosted/.env.production \
     -f deploy/self-hosted/docker-compose.stage4a.yml \
     -f deploy/self-hosted/docker-compose.production.example.yml \
     up -d --build
   ```

5. Run Stage 4K smoke and Stage 4M post-deploy/backup/rollback plans.
6. Keep the first production admin bootstrap inside the operator-owned
   PostgreSQL process. Do not delegate auth, database, object storage, or
   Device Bridge control to an external managed runtime.

## Verification

```bash
npm run test:stage5a
npm run check:stage5a
npm run preflight:stage5a
```

`check:stage5a` verifies the release-candidate script, env template, docs,
workflow, package scripts, `preflight:all` wiring, and the self-hosted product
boundary.
