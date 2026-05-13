# Stage 4K — Self-hosted deploy smoke

Stage 4K verifies that Dermatolog Pro can run as one self-hosted product:
frontend, backend, PostgreSQL, and backend-owned object storage are started
through Docker Compose and exercised through real HTTP calls.

## Scope

The smoke checks:

- `npm run build` produces `dist/` for the Nginx frontend container.
- `docker compose -f deploy/self-hosted/docker-compose.stage4a.yml up -d --build`
  starts the self-hosted stack.
- `/healthz` and `/readyz` become reachable through the reverse proxy.
- unauthenticated `GET /api/v1/patients` returns `401`.
- demo doctor login succeeds through `POST /api/v1/auth/login`.
- authenticated patient list and patient visits are readable.
- a small asset is uploaded through `POST /api/v1/visits/{visitId}/assets`.
- the backend-owned download route is issued and `GET /api/v1/assets/{assetId}/download`
  returns the exact uploaded bytes.
- the asset upload/download path proves Stage 4J binary storage works inside
  the composed product stack.
- cleanup runs `docker compose ... down -v` unless `--keep-up-on-fail` is passed.

## Commands

Fast local guard:

```bash
npm run preflight:stage4k
```

Dry run:

```bash
npm run smoke:stage4k:dry-run
```

Full compose smoke:

```bash
npm run smoke:stage4k
```

By default the smoke uses `APP_PORT=18080` to avoid collisions with local
development servers. Override it with:

```bash
node scripts/stage4k-self-hosted-compose-smoke.mjs --app-port 18081
```

## CI

`.github/workflows/stage4k-self-hosted-deploy-smoke.yml` runs:

- `npm run preflight:stage4k`
- `npm run smoke:stage4k -- --keep-up-on-fail --summary test-results/stage4k-compose-smoke-report.md`

On failure, the workflow collects Docker Compose logs before cleanup. The
workflow is available as a PR/push gate for Stage 4K files and as a scheduled
nightly/manual deployment smoke.

## Data

`0007_stage4k_deploy_smoke_seed.sql` adds a harmless demo visit and lesion for
the existing demo clinic, demo doctor, and demo patient. It uses fixed UUIDs and
`on conflict (id) do nothing` so local resets remain deterministic.

## Privacy and Runtime Boundary

- The smoke report does not print bearer tokens, passwords, object keys,
  storage paths, raw asset bytes, or patient names.
- The smoke uses only self-hosted routes and Docker Compose services.
- The Stage 4K guard scans protected files for managed-runtime coupling.
