# Stage 5J — Production visit schedule contracts

Stage 5J moves the clinical visit list/schedule to the self-hosted product
boundary. In production mode, `/visits` must read only from the operator-owned
backend and PostgreSQL.

## Scope

- Backend contract: `GET /api/v1/visits`.
- Backend source: PostgreSQL tables `visits`, `patients`, and `clinics`.
- RBAC: `visitReadScope`, with doctor users scoped to their own visits and
  clinic/system admins scoped by clinic policy.
- Audit: `visit.schedule.list`.
- Frontend route: `/visits`.
- Frontend production source: `listSelfHostedVisits` against `/api/v1/visits`.
- Demo/dev source: `VisitsPageDemo` with mock data.

## Production boundary

Protected Stage 5J files must not depend on managed runtime services:

- no `api-read` / `api-write`;
- no Edge Function contract;
- no `SUPABASE_*` runtime coupling;
- no browser hardware APIs;
- no signed URL or storage path exposure;
- no `mock-data` import in production schedule files.

## Verification

```bash
npm run preflight:stage5j
npm run preflight:stage5i
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- `npm run preflight:stage5j` passes backend route/repository/service tests,
  frontend API/page tests, guard, and no-deno-locks.
- `/api/v1/meta` reports Stage `5J`, `visitSchedule`, and `/api/v1/visits`.
- `/openapi.stage5j.json` documents the schedule contract.
- `/visits` in production shows `Источник данных: self-hosted backend /api/v1/visits`.
- `package-lock.json` remains unchanged.
