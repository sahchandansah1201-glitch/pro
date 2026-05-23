# Stage 21A-21Z · Clinical Follow-Up SOP Validation

Stage 21A-21Z turns the Stage 20A-20Z clinic-review layer into a local,
clinic-specific SOP validation workflow for follow-up state transitions.

## Scope

- Adds local SOP validation fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_validation_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-validation/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-validation`.
- Publishes `/openapi.stage21a-21z.json`.
- Adds frontend API helpers and a doctor workspace SOP validation panel.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP validation evidence is local metadata only.
- The repository does not prove external SOP completion, medical correctness,
  or clinic policy approval outside this self-hosted product boundary.

## Local State

`clinical_follow_up_tasks` now stores:

- `sop_validation_state`
- `sop_policy_version`
- `sop_exception_reason`
- `sop_validated_by_user_id`
- `sop_validated_at`

Allowed SOP states:

- `not_required`
- `required`
- `validated`
- `exception`
- `blocked`

## Verification

```bash
npm run test:stage21a-21z
npm run check:stage21a-21z
npm run preflight:stage21a-21z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 21A-21Z synced from main, no conflicts.
```
