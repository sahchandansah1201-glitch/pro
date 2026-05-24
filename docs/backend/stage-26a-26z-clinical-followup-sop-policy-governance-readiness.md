# Stage 26A-26Z - Clinical Follow-Up SOP Policy Governance Readiness

Stage 26A-26Z extends Stage 25A-25Z local SOP policy audit rollup with a local
governance readiness checkpoint for follow-up tasks that have reached clinic SOP
policy review.

## Scope

- Adds SOP policy governance readiness fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_policy_governance_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-governance/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance`.
- Publishes `/openapi.stage26a-26z.json`.
- Adds frontend API helpers and doctor workspace governance readiness controls.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP policy governance readiness is local metadata only.
- The repository does not prove external SOP approval, medical correctness,
  legal governance sign-off, or remediation outside this self-hosted product
  boundary.

## Local State

`clinical_follow_up_tasks` stores:

- `sop_policy_governance_state`
- `sop_policy_governance_note`
- `sop_policy_governance_reviewed_by_user_id`
- `sop_policy_governance_reviewed_at`

`clinical_follow_up_sop_policy_governance_events` stores append-only local
governance readiness state changes.

## Verification

```bash
npm run test:stage26a-26z
npm run check:stage26a-26z
npm run preflight:stage26a-26z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 26A-26Z synced from main, no conflicts.
```
