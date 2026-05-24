# Stage 24A-24Z · Clinical Follow-Up SOP Policy Exception Closure

Stage 24A-24Z extends Stage 23A-23Z local SOP policy application with local
exception closure metadata for follow-up tasks that have drift or SOP exception
review.

## Scope

- Adds SOP policy exception closure fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_policy_exception_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-exceptions/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-exception`.
- Publishes `/openapi.stage24a-24z.json`.
- Adds frontend API helpers and doctor workspace exception closure controls.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP policy exception closure is local metadata only.
- The repository does not prove external SOP completion, medical correctness,
  or clinic policy approval outside this self-hosted product boundary.

## Local State

`clinical_follow_up_tasks` stores:

- `sop_policy_exception_state`
- `sop_policy_exception_reason`
- `sop_policy_exception_resolution`
- `sop_policy_exception_closed_by_user_id`
- `sop_policy_exception_closed_at`

`clinical_follow_up_sop_policy_exception_events` stores append-only local
exception opening, acceptance, rejection, and closure changes.

## Verification

```bash
npm run test:stage24a-24z
npm run check:stage24a-24z
npm run preflight:stage24a-24z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 24A-24Z synced from main, no conflicts.
```
