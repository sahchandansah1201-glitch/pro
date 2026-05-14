# Stage 4N — Production observability and audit

Stage 4N adds the first production observability layer to the self-hosted
product. The goal is operational visibility without leaking clinical data,
tokens, object keys, storage paths, or raw environment values.

## Scope

- Structured JSON logs: `backend/self-hosted/ops-logger.mjs`.
- Correlation header propagation: `x-correlation-id` on JSON responses.
- System-admin status endpoint: `GET /api/v1/ops/status`.
- Metadata-only audit export dry-run: `scripts/stage4n-audit-export.mjs`.
- OpenAPI: `backend/self-hosted/openapi.stage4n.json`.
- Guard: `scripts/check-stage4n-production-observability.mjs`.
- Workflow: `.github/workflows/stage4n-production-observability-audit.yml`.
- Preflight: `npm run preflight:stage4n`.

## Structured JSON logs

The backend server now uses structured JSON logs for startup, shutdown, and
HTTP request summaries. Request logs include:

- `ts`
- `level`
- `event`
- `service`
- `stage`
- `method`
- `path`
- `status`
- `durationMs`
- `correlationId`

The logged path is path-only. Query strings are intentionally excluded because
they can contain signed URL parameters or tokens.

## Redaction rules

The logger redacts:

- bearer tokens
- cookies and authorization values
- passwords, secrets, JWT values, and access tokens
- email addresses
- patient full names
- object bucket/key values
- storage object paths
- URL parameters such as `sig`, `signature`, and `access_token`

The logger never writes request bodies.

## Ops status endpoint

`GET /api/v1/ops/status` is restricted to `system_admin`.

It returns readiness state, dependency names/statuses, observability settings,
and audit export metadata. It does not return raw `DATABASE_URL`, passwords,
bearer tokens, patient names, object keys, storage paths, or object storage
credentials.

Expected local check:

```bash
npm run preflight:stage4n
```

## Audit export dry-run

Stage 4N intentionally starts with a safe dry-run export plan:

```bash
npm run ops:stage4n:audit-export:dry-run
```

The export plan includes only metadata columns:

- `created_at`
- `action`
- `entity_type`
- `entity_id`
- `correlation_id`

Excluded data: request bodies, tokens, passwords, patient names, object keys,
storage paths, and raw env values.

## CI and local checks

```bash
npm run test:stage4n
npm run check:stage4n
npm run preflight:stage4n
```

`preflight:stage4n` is included in `preflight:all`.

## Runtime boundary

Stage 4N remains self-hosted:

- No managed-runtime coupling.
- No `api-read`, `api-write`, edge function, or managed auth dependency.
- No `SUPABASE_*` runtime dependency.
- Observability and audit reports are generated from the self-hosted backend,
  local Docker stack, PostgreSQL metadata, and backend-owned logs.
