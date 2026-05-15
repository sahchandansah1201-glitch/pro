# Stage 5L · Production leads/appointments writes

Stage 5L closes the next production gap on the doctor dashboard: intake
leads are no longer read-only. The self-hosted backend can now create a
lead, update its qualification state, and convert a lead into a local
visit appointment.

## Scope

- `POST /api/v1/leads` creates a lead in the local PostgreSQL `leads`
  table.
- `PATCH /api/v1/leads/{leadId}` updates lead status to `new`,
  `qualified`, or `lost`.
- `POST /api/v1/leads/{leadId}/book-appointment` marks the lead
  `booked` and inserts a `visits` row with `draft` status.
- `/desk` in production keeps using the self-hosted API only. The
  "Лиды и записи" card can create a safe lead summary, qualify a lead,
  and create an appointment from a patient-linked lead.

## Boundary

- Database: local PostgreSQL only.
- Runtime: self-hosted backend only.
- No Supabase, Edge Functions, browser hardware APIs, signed URLs,
  storage paths, or external CRM runtime dependency in protected Stage
  5L files.
- Lead summaries are patient-safe short summaries, not raw chat
  transcripts or external payload dumps.

## RBAC and audit

- `system_admin`, `clinic_admin`, `doctor`, and `operator` can write
  leads within their clinic scope.
- `assistant` cannot mutate leads or book appointments.
- Audit events:
  - `lead.create`
  - `lead.status.update`
  - `lead.appointment.book`

## Files

- `backend/self-hosted/leads-appointments-write-repository.mjs`
- `backend/self-hosted/leads-appointments-write-service.mjs`
- `backend/self-hosted/openapi.stage5l.json`
- `src/lib/self-hosted-leads-appointments-api.ts`
- `src/pages/doctor/DeskPageLive.tsx`
- `scripts/check-stage5l-production-leads-appointments-writes.mjs`

## Verification

```bash
npm run preflight:stage5l
npm run preflight:stage5k
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- Stage 5L tests pass.
- Guard reports 14 checked files.
- `package-lock.json` is unchanged.
- No `deno.lock` exists.
- Production dashboard writes use only `/api/v1/leads`,
  `/api/v1/leads/{leadId}`, and
  `/api/v1/leads/{leadId}/book-appointment` on the self-hosted backend.
