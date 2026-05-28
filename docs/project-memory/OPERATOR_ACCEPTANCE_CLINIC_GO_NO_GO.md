# OPERATOR_ACCEPTANCE_CLINIC_GO_NO_GO

## Purpose

This checklist defines the clinic operator acceptance and go/no-go decision
that must happen outside repository evidence before Dermatolog Pro is used in a
real clinic workflow.

This is not Stage 49A-49Z. It is a repository-owned checklist template for an
external operator decision.

## Go Criteria

| Area | Operator check | Repository evidence | External evidence required |
| --- | --- | --- | --- |
| Roles and access | Verify production users, RBAC roles, least privilege, doctor/operator/system-admin boundaries, and patient portal access. | Self-hosted auth/RBAC and portal contracts exist in repository. | Yes |
| Patient and visit workflow | Verify patient lookup, visit workspace, lesions/report flow, follow-up queue, and patient portal with clinic-approved test data. | Clinical workspace and follow-up tests exist in repository. | Yes |
| SOP policy governance | Verify local SOP templates, application, exceptions, audit rollup, governance, archive readiness, handoff, receipt, and reconciliation fit the clinic process. | Stage 22A-47Z local SOP policy governance chain exists in repository. | Yes |
| Privacy and data handling | Verify local data handling, backup policy, audit retention, access review, and no secrets or PHI in git. | Repository guards protect artifacts from secret-like and storage-object markers. | Yes |
| Operations and recovery | Verify deployment readiness, health/readiness checks, backup restore, incident path, and Device Bridge boundaries where applicable. | Self-hosted ops, release archive, and Device Bridge readiness artifacts exist in repository. | Yes |
| Legal and clinical approval | Obtain clinic-owner, legal/compliance, and clinical-owner approval before real use. | Repository explicitly does not prove external legal approval, clinical approval, or medical correctness. | Yes |

## No-Go Criteria

- Any required role, portal, clinical workspace, SOP governance, privacy,
  backup, or recovery check is unverified.
- Clinic operator cannot identify accountable owners for legal/compliance and
  clinical approval.
- Production users or patient data are used before external clinic approval.
- Repository artifacts are treated as proof of medical correctness or legal
  sufficiency.
- A future numbered batch is started without a new explicit plan decision.

## Acceptance Record Template

| Field | Value |
| --- | --- |
| Clinic | External record only |
| Operator | External record only |
| Review date | External record only |
| Decision | `go`, `no-go`, or `conditional-go` |
| Conditions | External record only |
| Approver signoff | External record only |

## Boundaries

- Runtime behavior added: false.
- Database migration added: false.
- OpenAPI contract added: false.
- Frontend workflow added: false.
- Stage 49A-49Z defined: false.
- External legal approval proof: false.
- External clinical approval proof: false.
- Medical correctness proof: false.

## Expected Lovable Confirmation

`Confirmed: Operator Acceptance / Clinic Go-No-Go checklist synced from main, no conflicts.`
