# Stage 4M — Production deployment verification

Stage 4M turns the self-hosted stack into a repeatable server deployment
procedure. Stage 4K proved the compose stack works; Stage 4L added backup and
restore primitives. Stage 4M verifies first boot, post-deploy health, backup
after deploy, operator-triggered updates, and rollback drill planning.

## Scope

- Deployment verifier: `scripts/stage4m-production-deploy-verify.mjs`.
- Guard: `scripts/check-stage4m-production-deploy.mjs`.
- Workflow: `.github/workflows/stage4m-production-deployment-verification.yml`.
- Preflight: `npm run preflight:stage4m`.
- Production inputs from Stage 4L:
  - `deploy/self-hosted/.env.production.example`
  - `deploy/self-hosted/docker-compose.production.example.yml`
  - `scripts/stage4l-self-hosted-ops.mjs`

## Production frontend mode

Production builds must include the Vite keys from `.env.production`:

```bash
VITE_APP_MODE=production
VITE_SELF_HOSTED_API_BASE_URL=https://pro.skindoktor.ru
```

If `VITE_APP_MODE` is missing or not `production`, the browser shell stays in
demo mode. In that state `/admin` and other demo role screens can open without
the self-hosted login session. Stage 4M now rejects that build before publishing
it.

## First boot

Dry-run first:

```bash
npm run deploy:stage4m:first-boot:dry-run
```

On a server, after creating `deploy/self-hosted/.env.production`, run:

```bash
node scripts/stage4m-production-deploy-verify.mjs first-boot \
  --project-name dermatolog-pro-production \
  --app-port 8080 \
  --env-file deploy/self-hosted/.env.production
```

First boot verifies:

1. Stage 4L production env validation.
2. Frontend build with `VITE_APP_MODE=production`.
3. Production compose config.
4. Production compose startup.
5. `/healthz`.
6. `/readyz`.

## Operational update

After a change is merged to `main`, update the single-server staging/production
test stand with one command from the deployed checkout:

```bash
cd /opt/dermatolog-pro/app
bash deploy/self-hosted/update-production.sh
```

Equivalent npm entrypoint:

```bash
npm run deploy:self-hosted:update
```

The wrapper takes a lock with `flock`, so two updates cannot run at the same
time. It calls:

```bash
node scripts/stage4m-production-deploy-verify.mjs update \
  --project-name dermatolog-pro-production \
  --app-port 8080 \
  --env-file deploy/self-hosted/.env.production \
  --backup-root /opt/dermatolog-pro/backups \
  --summary /opt/dermatolog-pro/logs/update-production-summary.md
```

Update sequence:

1. verify `.env.production`;
2. create a pre-update backup;
3. fetch and fast-forward `main`;
4. run `npm ci`;
5. build frontend with the production auth gate;
6. rebuild/restart Docker Compose;
7. verify `/healthz`, `/readyz`, and frontend HTML;
8. capture safe compose status.

Dry-run:

```bash
npm run deploy:stage4m:update:dry-run
```

## Post-deploy smoke

Dry-run:

```bash
npm run deploy:stage4m:post-deploy:dry-run
```

Run against the deployed server:

```bash
node scripts/stage4m-production-deploy-verify.mjs post-deploy \
  --project-name dermatolog-pro-production \
  --app-port 8080 \
  --env-file deploy/self-hosted/.env.production
```

Post-deploy verification runs the Stage 4K smoke with the production project
name and captures safe compose status. The smoke covers login, patients, visits,
asset upload, backend-owned download route, and byte-for-byte asset download.

## Backup after deploy

Dry-run:

```bash
npm run deploy:stage4m:backup-after-deploy:dry-run
```

Run a backup immediately after a successful deployment:

```bash
node scripts/stage4m-production-deploy-verify.mjs backup-after-deploy \
  --project-name dermatolog-pro-production \
  --env-file deploy/self-hosted/.env.production
```

This delegates to Stage 4L backup and writes:

- `postgres.dump`
- `object-storage.tgz`
- `stage4l-backup-manifest.json`

## Rollback drill

Dry-run:

```bash
npm run deploy:stage4m:rollback-drill:dry-run
```

The dry-run is required before doing a destructive restore. A live rollback
drill must pass an explicit confirmation:

```bash
node scripts/stage4m-production-deploy-verify.mjs rollback-drill \
  --project-name dermatolog-pro-production \
  --env-file deploy/self-hosted/.env.production \
  --backup-dir backups/self-hosted/<timestamp> \
  --confirm=ROLLBACK_TO_SELF_HOSTED_BACKUP
```

Rollback drill delegates to Stage 4L restore. Stage 4L restore starts the stack
and runs Stage 4K smoke as post-restore verification.

## CI and local checks

```bash
npm run test:stage4m
npm run check:stage4m
npm run preflight:stage4m
```

CI only runs dry-run plans and guards. It does not mutate live server volumes.

## Privacy and boundary rules

- Deployment reports do not print raw tokens, credentials, patient names, object
  keys, storage paths, or env values.
- Stage 4M keeps the product self-hosted. It does not introduce Supabase,
  `api-read`, `api-write`, edge function, or `SUPABASE_*` runtime coupling.
- Real rollback requires `ROLLBACK_TO_SELF_HOSTED_BACKUP`; dry-run output is safe
  to paste into release notes.
