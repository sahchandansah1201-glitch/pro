# Stage 18A-18Z — Clinical follow-up operations hardening

## Scope

Stage 18A-18Z turns the Stage 17 local follow-up communication loop into an
operational queue that clinic staff can control without introducing an outside
notification runtime.

Implemented surfaces:

- PostgreSQL migration `0025_stage18_followup_operations_hardening.sql`.
- Operations queue fields on `clinical_follow_up_tasks`: triage, escalation,
  SLA, delivery state, attempts, local evidence, operations note, and resolved
  metadata.
- Append-only `clinical_follow_up_operations_events`.
- Backend contracts:
  - `GET /api/v1/clinical/follow-ups/operations`
  - `GET /api/v1/clinical/follow-ups/operations/summary`
  - `PATCH /api/v1/clinical/follow-ups/{followUpId}/operations`
- OpenAPI contract `openapi.stage18a-18z.json`.
- Doctor visit workspace live panel: summary counts, queue refresh, waiting,
  escalation, and local close actions.

## Product Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- PostgreSQL remains the source of truth.
- Delivery evidence is local metadata only; it does not call an SMS, email, or
  push vendor.
- No signed URLs, storage paths, provider tokens, or patient-hidden internal
  notes are exposed to patient-facing endpoints.

## RBAC

- Read queue and summary: `visitReadScope`.
- Update operations state: `visitWriteScope`.
- Patient portal follow-up endpoints remain Stage 17 patient-owned and do not
  expose operations notes or internal notes.

## Audit

Stage 18 adds audit actions:

- `clinical_follow_up.operations.list`
- `clinical_follow_up.operations.summary`
- `clinical_follow_up.operations.update`

Every operations update also writes a local
`clinical_follow_up_operations_events` row with previous and next safe state.

## Verification

```bash
npm run test:stage18a-18z
npm run check:stage18a-18z
npm run preflight:stage18a-18z
```

Expected:

- Repository/service/routes/frontend tests pass.
- Guard reports Stage 18 files and markers present.
- `check-no-deno-locks` passes.
- `package-lock.json` remains unchanged.
