# Stage 22A-22Z · Clinical Follow-Up SOP Policy Templates

Stage 22A-22Z turns the Stage 21A-21Z SOP validation state into configurable
local clinic SOP policy templates.

## Scope

- Adds `clinical_follow_up_sop_policy_templates`.
- Adds append-only `clinical_follow_up_sop_policy_template_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-templates/summary`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-templates`.
- Adds `POST /api/v1/clinical/follow-ups/sop-policy-templates`.
- Adds `PATCH /api/v1/clinical/follow-ups/sop-policy-templates/{templateId}`.
- Publishes `/openapi.stage22a-22z.json`.
- Adds frontend API helpers and a doctor workspace SOP policy template panel.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP policy templates are local configuration only.
- The repository does not prove external SOP completion, medical correctness,
  or clinic policy approval outside this self-hosted product boundary.

## Local State

`clinical_follow_up_sop_policy_templates` stores:

- `code`
- `title`
- `version`
- `description`
- `applies_to`
- `required_validation_states`
- `default_validation_state`
- `exception_allowed`
- `active`

## Verification

```bash
npm run test:stage22a-22z
npm run check:stage22a-22z
npm run preflight:stage22a-22z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 22A-22Z synced from main, no conflicts.
```
