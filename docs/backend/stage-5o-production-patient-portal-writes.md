# Stage 5O — Production patient portal writes

Stage 5O adds the first patient-owned write boundary to the production
patient portal while preserving the self-hosted product contract.

## Scope

- `POST /api/v1/me/booking-requests`
- `PATCH /api/v1/me/reminder-preferences`
- `GET /openapi.stage5o.json`

The patient can request an appointment window and adjust reminder
preferences. The patient cannot create visits, change clinical records,
write reports, or access physician-only report text.

## Data Ownership

- Booking requests are stored in `patient_portal_booking_requests`.
- Reminder preferences are stored in
  `patient_portal_reminder_preferences`.
- Both tables are scoped by `patient_user_links`.
- The backend uses local PostgreSQL only.
- Managed runtime/database dependency: none.

## Frontend Behavior

- `/me/booking` in production sends booking requests to the self-hosted
  backend and lists prior local requests.
- `/me/reminders` in production updates backend-owned reminder
  preferences.
- Demo/dev mode keeps the historical mock patient portal.

## Boundary Rules

- No Supabase runtime.
- No `api-read` / `api-write`.
- No Edge Functions.
- No browser hardware APIs.
- No signed URLs, storage paths, physician-only report text, or external
  notification provider dependency in protected runtime files.

## Verification

```bash
npm run preflight:stage5o
```

Expected:

- backend patient portal repository/service/routes tests pass
- frontend patient portal API/page tests pass
- Stage 5O guard passes
- `node scripts/check-no-deno-locks.mjs` passes
- `package-lock.json` stays unchanged
