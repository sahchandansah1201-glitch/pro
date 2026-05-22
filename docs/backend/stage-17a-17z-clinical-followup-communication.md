# Stage 17A-17Z — Clinical follow-up and patient communication loop

Stage 17A-17Z turns the Stage 16 product-cycle hypothesis into a working
self-hosted product flow:

1. The doctor creates a follow-up task from the live visit workspace.
2. The backend stores the task and local message state in PostgreSQL.
3. The patient sees patient-safe follow-up context in the portal reminders
   page.
4. The patient can reply to the clinic through the same self-hosted backend.
5. Staff can list, update, and message follow-up tasks through RBAC-protected
   contracts.

## Product Boundary

- Managed runtime/database dependency: none.
- Runtime: self-hosted Node backend.
- Database: self-hosted PostgreSQL.
- Notification provider dependency: none. Stage 17 stores local portal
  communication only; external delivery is not required for product operation.
- Browser hardware API dependency: none.
- Patient-facing endpoints never return `internalNote`, object storage paths,
  signed URLs, access tokens, or raw infrastructure values.

## Backend Contracts

- `GET /api/v1/clinical/follow-ups`
- `POST /api/v1/visits/{visitId}/follow-ups`
- `PATCH /api/v1/clinical/follow-ups/{followUpId}`
- `POST /api/v1/clinical/follow-ups/{followUpId}/messages`
- `GET /api/v1/me/follow-ups`
- `POST /api/v1/me/follow-ups/{followUpId}/messages`
- `/openapi.stage17a-17z.json`

Staff read access uses clinic-scoped visit read RBAC. Staff write access uses
doctor/system-admin visit write RBAC. Patient access uses the linked patient
portal scope.

## Data Model

`0024_stage17_clinical_followup_communication.sql` adds:

- `clinical_follow_up_tasks`
- `clinical_follow_up_messages`

Both tables are local PostgreSQL tables. Follow-up messages use `local_only`
delivery state by default and do not depend on a managed messaging provider.

## Frontend Contracts

- `VisitWorkspaceLiveActions` adds the "Контроль и связь" live form for doctors.
- `MeRemindersPageLive` adds the "Контроль и сообщения клиники" patient panel.
- `self-hosted-follow-up-api.ts` owns all Stage 17 frontend calls.

Demo/dev mode remains unchanged; production mode uses only the self-hosted API
session and `/api/v1/*` contracts.

## Verification

```bash
npm run test:stage17a-17z
npm run check:stage17a-17z
npm run preflight:stage17a-17z
```

`preflight:stage17a-17z` also runs the Stage 16 product-cycle preflight,
project-memory guard, TypeScript check, deno-lock guard, and whitespace diff
check.
