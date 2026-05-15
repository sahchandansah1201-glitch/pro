# Stage 5M · Production intake operator workspace

Stage 5M cuts the operator console over to production intake contracts.
The `/operator` route no longer shows the historical demo dialog console
when `VITE_APP_MODE=production`.

## Scope

- `src/pages/operator/OperatorConsolePage.tsx` is now a mode wrapper.
- `OperatorConsolePageDemo` preserves the existing mock dialog console for
  demo and development mode.
- `OperatorConsolePageLive` is the production workspace and reads from
  `GET /api/v1/leads/appointments`.
- The production workspace writes only through:
  - `POST /api/v1/leads`
  - `PATCH /api/v1/leads/{leadId}`
  - `POST /api/v1/leads/{leadId}/book-appointment`
- The production sidebar changes the operator menu from dialog-oriented
  labels to a single "Лиды" workspace entry.

## Boundary

- Runtime: self-hosted backend only.
- Database: operator-owned local PostgreSQL only.
- No Supabase, Edge Functions, browser hardware APIs, signed URLs,
  storage paths, external CRM runtime dependency, or managed database
  dependency in protected Stage 5M files.
- Demo/dev still keeps the existing dialog simulator, but production does
  not fall back to it.

## UX contract

- Production status announces the self-hosted source:
  `self-hosted backend /api/v1/leads/appointments`.
- Operator can create a safe lead summary, qualify a lead, mark it lost,
  and book a patient-linked lead into a visit.
- If the backend token is missing or a request fails, the UI shows a
  blocking production error instead of rendering mock dialog data.

## Verification

```bash
npm run preflight:stage5m
npm run preflight:stage5l
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- Stage 5M unit tests pass.
- Guard reports 11 checked files.
- `package-lock.json` is unchanged.
- No `deno.lock` exists.
- `/operator` in production uses only the self-hosted leads/appointments
  contracts.
