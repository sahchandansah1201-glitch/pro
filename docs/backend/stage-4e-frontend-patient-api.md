# Stage 4E — Frontend patient API integration

Stage 4E connects the existing Patients page to the self-hosted Stage 4D
patient API while preserving the safe demo fallback. This is the first
frontend/backend bridge for the standalone product: the UI can read, create,
update, and soft-archive patients through the local backend when a self-hosted
browser session token is present.

## 1. Scope

- `src/lib/self-hosted-api-session.ts` reads the runtime self-hosted API
  session from browser storage and `VITE_SELF_HOSTED_API_BASE_URL`.
- `src/lib/self-hosted-patient-api.ts` is the only frontend client for
  `/api/v1/patients`.
- `src/pages/doctor/PatientsPage.tsx` switches between:
  - demo fallback when no self-hosted token exists;
  - live backend mode when the token exists.
- Live mode supports:
  - `GET /api/v1/patients`
  - `GET /api/v1/patients/{patientId}`
  - `POST /api/v1/patients`
  - `PATCH /api/v1/patients/{patientId}`
  - `DELETE /api/v1/patients/{patientId}` as soft archive.

## 2. Runtime session

The frontend does not add a new managed backend dependency. A local
self-hosted session is read from:

- `derma-pro:self-hosted-api-base-url`
- `derma-pro:self-hosted-api-token`

If the token is missing, Patients stays in demo mode and does not call the
network. `VITE_SELF_HOSTED_API_BASE_URL` is only a base URL convenience; it is
not a secret and does not contain credentials.

## 3. UX behavior

- Demo mode keeps the existing warning: "Кнопка «Новый пациент» не создаёт
  запись".
- Live mode changes the gate copy to "Self-hosted backend подключён" and
  enables the "Новый пациент" form.
- Edit and archive actions keep the same row-level controls, but persist
  through the self-hosted API.
- Archive is explicit soft archive; no physical deletion is triggered.
- Backend RBAC/list failures are surfaced in a polite status region and the
  safe demo list remains visible.

## 4. Data safety

- The API client allow-lists patient fields and maps them into the existing
  frontend `Patient` shape.
- Error messages are mapped from the public Stage 4D JSON error envelope.
- Tokens, raw backend response internals, object-storage paths, and managed
  backend fields are not rendered.
- `PatientsPage.tsx` still avoids direct network and browser storage access;
  that logic lives in `src/lib`.

## 5. Self-hosted boundary

Stage 4E must not introduce managed runtime coupling. The guard rejects these
tokens in the Stage 4E runtime files:

- `supabase`
- `api-read`
- `api-write`
- `edge function`
- `SUPABASE_`

Historical Stage 1 Supabase files remain in the repository, but Stage 4E does
not extend them.

## 6. Verification

```bash
npm run test:stage4e
npm run check:stage4e
npm run preflight:stage4e
npm run preflight:all -- --dry-run
```

`npm run preflight:all` includes Stage 4E after Stage 4D.

## 7. Next stage

Stage 4F should add the first self-hosted frontend login/session UX so users
do not have to seed the local browser token manually.
