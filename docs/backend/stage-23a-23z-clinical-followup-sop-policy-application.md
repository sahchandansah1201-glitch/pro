# Stage 23A-23Z · Clinical Follow-Up SOP Policy Application

Stage 23A-23Z applies local Stage 22A-22Z SOP policy templates to Stage
21A-21Z follow-up SOP validation metadata and records local drift-review state.

## Scope

- Adds SOP policy application fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_policy_application_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-application/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-application`.
- Publishes `/openapi.stage23a-23z.json`.
- Adds frontend API helpers and doctor workspace policy-application controls.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP policy application is local metadata only.
- The repository does not prove external SOP completion, medical correctness,
  or clinic policy approval outside this self-hosted product boundary.

## Local State

`clinical_follow_up_tasks` stores:

- `sop_policy_template_id`
- `sop_policy_template_code`
- `sop_policy_drift_state`
- `sop_policy_drift_reason`
- `sop_policy_applied_at`
- `sop_policy_drift_reviewed_at`

`clinical_follow_up_sop_policy_application_events` stores append-only local
application/drift review changes.

## Verification

```bash
npm run test:stage23a-23z
npm run check:stage23a-23z
npm run preflight:stage23a-23z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 23A-23Z synced from main, no conflicts.
```
