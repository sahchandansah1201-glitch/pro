# Stage 25A-25Z · Clinical Follow-Up SOP Policy Audit Rollup

Stage 25A-25Z extends Stage 24A-24Z local SOP policy exception closure with a
local audit rollup for follow-up tasks that are ready for clinic policy review.

## Scope

- Adds SOP policy audit fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_policy_audit_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-audit/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-audit`.
- Publishes `/openapi.stage25a-25z.json`.
- Adds frontend API helpers and doctor workspace audit rollup controls.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP policy audit rollup is local metadata only.
- The repository does not prove external SOP completion, medical correctness,
  clinic governance approval, or remediation outside this self-hosted product
  boundary.

## Local State

`clinical_follow_up_tasks` stores:

- `sop_policy_audit_state`
- `sop_policy_audit_note`
- `sop_policy_audit_reviewed_by_user_id`
- `sop_policy_audit_reviewed_at`

`clinical_follow_up_sop_policy_audit_events` stores append-only local audit
review state changes.

## Verification

```bash
npm run test:stage25a-25z
npm run check:stage25a-25z
npm run preflight:stage25a-25z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 25A-25Z synced from main, no conflicts.
```
