# Stage 5K — Production Leads/Appointments Contracts

Stage 5K moves the "Лиды и записи" dashboard block off demo/mock data in
production mode. The production source is the self-hosted backend only:
`GET /api/v1/leads/appointments`.

## Scope

- Add local PostgreSQL `leads` table for intake metadata.
- Derive appointment rows from local `visits`.
- Expose a read-only backend contract with RBAC scope and audit event
  `leads.appointments.overview.read`.
- Show the production overview inside `/desk` through
  `src/lib/self-hosted-leads-appointments-api.ts`.
- Keep demo/dev dashboard behavior separate.

## Boundary

Stage 5K remains inside the operator-owned product boundary:

- managed runtime: none;
- managed database: none;
- production data source: local PostgreSQL through the self-hosted backend;
- no Supabase, api-read/api-write, Edge Functions, browser hardware APIs,
  signed URLs, or storage paths in protected production files.

## Files

- `backend/self-hosted/db/migrations/0015_stage5k_leads_appointments_contract.sql`
- `backend/self-hosted/leads-appointments-repository.mjs`
- `backend/self-hosted/leads-appointments-service.mjs`
- `backend/self-hosted/openapi.stage5k.json`
- `src/lib/self-hosted-leads-appointments-api.ts`
- `src/pages/doctor/DeskPageLive.tsx`
- `scripts/check-stage5k-production-leads-appointments-contracts.mjs`

## Verification

```bash
npm run preflight:stage5k
npm run preflight:stage5j
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- `npm run preflight:stage5k` passes.
- `package-lock.json` remains unchanged.
- No `deno.lock` exists.
- `/desk` in production reads lead/appointment data only through
  `/api/v1/leads/appointments`.
- Demo/dev keeps historical mock dashboard data.
