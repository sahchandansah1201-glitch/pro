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
  --summary /opt/dermatolog-pro/logs/deploys/<run-id>/update-production-summary.md \
  --latest-summary /opt/dermatolog-pro/logs/update-production-summary.md \
  --receipt /opt/dermatolog-pro/logs/deploys/<run-id>/update-production-receipt.json \
  --latest-receipt /opt/dermatolog-pro/logs/update-production-receipt.json \
  --status-json /opt/dermatolog-pro/logs/deploys/<run-id>/update-production-status.json \
  --latest-status-json /opt/dermatolog-pro/logs/update-production-status.json \
  --run-id <run-id>
```

Each update now creates a separate run directory:

```text
/opt/dermatolog-pro/logs/deploys/<run-id>/
```

The current run writes:

- `update-production-summary.md` — human-readable release summary;
- `update-production-receipt.json` — machine-readable release receipt;
- `update-production-status.json` — current status for automation.

The wrapper also updates latest pointers:

- `/opt/dermatolog-pro/logs/update-production-summary.md`;
- `/opt/dermatolog-pro/logs/update-production-receipt.json`;
- `/opt/dermatolog-pro/logs/update-production-status.json`.

Operator status command:

```bash
npm run deploy:stage4m:status
```

The status command reads `/opt/dermatolog-pro/logs/update-production-status.json`
by default and prints the current run id, status, timestamps, git HEAD
before/after, and step results without raw logs or secrets.

At the beginning of the run, the latest summary/status are written as
`running`. This prevents an older successful summary from being mistaken for
the current deployment while `npm ci`, frontend build, or Docker restart is
still running.

Update sequence:

1. verify `.env.production`;
2. create a pre-update backup;
3. fetch and fast-forward `main`;
4. apply production schema migrations;
5. run the admin clinic database smoke in a rollback transaction;
6. run `npm ci`;
7. build frontend with the production auth gate into a staging directory;
8. rebuild/restart Docker Compose;
9. verify `/healthz`, `/readyz`, and frontend HTML;
10. capture safe compose status.

The admin clinic database smoke is deliberately not a mocked UI test. It runs
against the self-hosted PostgreSQL container and exercises the same SQL surface
used by `/api/v1/admin/clinics`: list clinics, create a clinic row, verify that
the row is visible to the list query, edit address/timezone, and run admin
analytics. The transaction is rolled back, so the deploy check leaves no test
clinic behind. If this smoke fails, deployment must remain failed even when
`/healthz` and `/readyz` are green.

The frontend build is deliberately safe for an already running server:

1. Vite builds into `.stage4m-build/frontend-next`.
2. Stage 4M verifies the staged `index.html`.
3. Only then does it publish staged files into `dist`, copying `index.html`
   last.

If the build fails, the existing `dist/index.html` remains untouched and nginx
continues to serve the last good frontend. The update command prints
`START`, `OK`, or `FAIL` for every step so operators can see where a long
operation is running.

After `docker compose up -d --build`, the backend may need time to reconnect
to PostgreSQL and object storage. Stage 4M therefore retries `/healthz` and
`/readyz` transient 5xx/connection failures before declaring the update failed.

The release receipt stores only safe metadata:

- run id, command, project, started/finished timestamps;
- git branch and short HEAD before/after the run;
- step labels and pass/fail status;
- explicit boundaries that secrets, patient data, raw env, and raw command
  output are not stored.

Dry-run:

```bash
npm run deploy:stage4m:update:dry-run
```

## Real admin API smoke

After a deployment, the operator can verify the exact production API path that
the browser uses for clinic creation. This command logs in with the generated
system administrator credentials, creates one test clinic, verifies that it
appears in `/api/v1/admin/clinics`, edits it, and verifies the edited row:

```bash
cd /opt/dermatolog-pro/app
node scripts/stage4m-admin-management-api-smoke.mjs \
  --api-base-url https://pro.skindoktor.ru \
  --credentials-file /root/dermatolog-pro-admin-credentials.txt \
  --confirm-create-test-clinic I_CONFIRM_CREATE_TEST_CLINIC
```

This command intentionally mutates production data by creating a clearly named
test clinic. It prints no password, bearer token, patient row, storage path,
signed URL, QR/session value, or credential. Use it when the question is not
"is the server healthy?", but "can a real system administrator create and edit
a clinic through the same HTTPS API as the UI?".

## Real admin browser smoke

After the API smoke passes, run the live browser journey. This is the closest
check to how a real person uses the screen: it opens `/self-hosted/login`, logs
in through the visible form, enters `/admin/clinics` through the product
navigation, tries the empty form, creates a test clinic, verifies that the row
appears in the list, edits it, verifies the updated row, inspects network
statuses, checks console/page errors, and saves desktop/mobile screenshots.

```bash
cd /opt/dermatolog-pro/app
npm run e2e:admin-management:live -- \
  --base-url https://pro.skindoktor.ru \
  --credentials-file /root/dermatolog-pro-admin-credentials.txt \
  --confirm-create-test-clinic I_CONFIRM_CREATE_TEST_CLINIC
```

This command intentionally mutates production data by creating and editing a
test clinic. It must not be replaced by mocked Playwright tests when verifying
the real client path. A deployment is not confirmed for the clinic create/edit
journey until this live browser smoke or an equivalent authenticated browser
trace passes.

The same closure rule applies to each production role journey. Run only after
`npm run deploy:stage4m:status` reports `ok`:

```bash
npm run e2e:doctor-workspace:live -- \
  --base-url https://pro.skindoktor.ru \
  --credentials-file /root/dermatolog-pro-admin-credentials.txt \
  --confirm-create-test-clinic I_CONFIRM_CREATE_TEST_CLINIC

npm run e2e:assistant-workspace:live -- \
  --base-url https://pro.skindoktor.ru \
  --credentials-file /root/dermatolog-pro-admin-credentials.txt \
  --confirm-create-test-clinic I_CONFIRM_CREATE_TEST_CLINIC

npm run e2e:operator-workspace:live -- \
  --base-url https://pro.skindoktor.ru \
  --credentials-file /root/dermatolog-pro-admin-credentials.txt \
  --confirm-create-test-clinic I_CONFIRM_CREATE_TEST_CLINIC

npm run e2e:patient-portal:live -- \
  --base-url https://pro.skindoktor.ru \
  --credentials-file /root/dermatolog-pro-admin-credentials.txt \
  --confirm-create-test-clinic I_CONFIRM_CREATE_TEST_CLINIC
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
