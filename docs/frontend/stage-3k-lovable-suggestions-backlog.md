# Stage 3K — Lovable suggestions backlog

## 1. Purpose

This document is the lightweight backlog for extra implementation ideas
that Lovable returns after a GitHub sync confirmation.

Lovable suggestions are not requirements by default. Codex triages them
before implementation so the project keeps small PRs, low Lovable token
usage, and clear product boundaries.

## 2. Triage states

- `Accepted` — useful, scoped, and safe to implement in the next small
  Codex PR.
- `Deferred` — potentially useful, but blocked by backend persistence,
  permissions, audit, release timing, or a larger product stage.
- `Rejected` — conflicts with project constraints, duplicates existing
  behavior, or adds risk without enough value.
- `Done` — implemented through GitHub, synced into Lovable, and
  confirmed without conflicts.

## 3. Decision rules

- Keep each accepted item tied to one screen or one workflow.
- Prefer demo-safe UI improvements over real patient data mutation until
  the backend stage explicitly owns persistence and permissions.
- Do not accept suggestions that introduce clipboard access,
  file-system downloads, `localStorage`, `sessionStorage`, direct doctor
  UI `fetch` calls, secrets, signed URLs, storage paths, or service-role
  keys.
- Batch only tightly related items into one PR.
- Every accepted item needs focused tests or a documented reason why a
  docs-only change is enough.

## 4. Current backlog

| ID | Suggestion | State | Reason / next action |
| --- | --- | --- | --- |
| LV-001 | Patient create affordance in demo mode | Done | Implemented as a non-mutating `Новый пациент` CTA in PR #18. |
| LV-002 | Local patient edit flow | Done | Implemented local-only edit dialog and validation in PR #19. |
| LV-003 | Patient preview, local delete, extended search, change log | Done | Implemented demo-safe patient actions and audit UI in PR #20. |
| LV-004 | Patient sorting, pagination, undo delete, change-log export | Done | Implemented in PR #21 without clipboard, file, storage, or API usage. |
| LV-005 | Real patient creation and backend persistence | Deferred | Repeated by Lovable after PR #22, PR #23, PR #24, PR #25, PR #26, and PR #27; still requires a dedicated backend/persistence stage with role permissions, audit, consent rules, and real data handling. |
| LV-006 | Real patient deletion | Deferred | Repeated by Lovable after PR #22, PR #23, PR #24, PR #25, PR #26, and PR #27; still requires backend ownership, irreversible-action policy, audit trail, and recovery/retention rules. |
| LV-007 | Bulk patient operations | Deferred | Needs a separate workflow design; avoid mixing with table convenience work. |
| LV-008 | Triage checklist template for future Lovable suggestions | Done | Added in PR #23 and confirmed after sync so each suggestion is classified before it becomes implementation scope. |
| LV-009 | Tests for real patient creation/deletion | Deferred | Repeated by Lovable after PR #24, PR #25, and PR #26; depends on LV-005/LV-006 real backend flows, so current demo/local tests remain valid until a backend persistence stage owns these cases. |
| LV-010 | Wire PatientsPage create/delete UI to backend | Deferred | Repeated by Lovable after PR #25 and PR #26; requires backend API contracts, role permissions, audit trail, error mapping, and real-data safeguards before doctor UI can call persistence. |
| LV-011 | Patient creation form | Deferred | Repeated by Lovable after PR #25 and PR #26; do not collect real patient data in demo mode before backend persistence, consent, validation, and audit ownership are designed. |
| LV-012 | Verify current demo/local create-delete UI | Done | Current scope is covered by PatientsPage tests for non-mutating create affordance and local delete/undo flows from PR #18, PR #20, and PR #21. |
| LV-013 | Error and status logging for real create/delete | Deferred | Repeated by Lovable after PR #26; requires backend error contracts and audit/status policy for real persistence; current demo/local status and change log remain sufficient for the non-persistent scope. |
| LV-014 | UX review for patient create/delete triage | Done | Added in PR #27 to document why real create/delete controls should stay out of the current demo UI until backend persistence owns the workflow. |
| LV-015 | Gate real patient create/delete | Done | Current Stage 3K decision gates real create/delete behind a future backend/persistence stage; no runtime backend-looking controls are added in the demo UI. |
| LV-016 | Demo-only patient create/delete flow | Done | Existing UI keeps create non-mutating and delete local/reversible, matching the current demo-only patient workflow. |
| LV-017 | Triage UX checklist UI | Deferred | Repeated by Lovable after PR #28 and PR #30; a visible UI for triage management is a separate internal workflow tool, and current need is covered by the Stage 3K markdown checklist. |
| LV-018 | Log demo action statuses | Done | Repeated by Lovable after PR #28; current PatientsPage demo/local actions use polite status messages and the patient change log for edit/delete/undo outcomes. |
| LV-019 | Surface patient action gate feedback to users | Done | Added in PR #29 as a persistent PatientsPage demo-only note and a clearer blocked-create status message. |
| LV-020 | Demo patient flow e2e tests | Done | Added a focused Playwright demo-patient flow in PR #30 covering the non-mutating create gate, local delete, undo, and unchanged gate note. |
| LV-021 | Patient gate accessibility check | Done | Added e2e coverage for the `role="note"` demo gate and polite create/delete status announcements in PR #30. |
| LV-022 | Demo patient reload e2e coverage | Done | Added PR #31 coverage proving local demo delete resets after reload and the gate note remains available. |
| LV-023 | Patient action live-region hardening | Done | Added an accessible name and atomic polite announcement behavior for patient action statuses in PR #31. |

## 5. Per-cycle update rule

After each Lovable confirmation, Codex should do one of the following:

- add a new backlog row;
- update an existing row state;
- explicitly say no backlog update is needed because Lovable reported
  only sync confirmation and no new suggestions.

Do not ask Lovable to rewrite the backlog. GitHub remains the source of
truth.

## 6. Lovable confirm prompt note

For changes that update this backlog, use confirmation-only prompts:

```text
Sync latest GitHub main.

Confirm only:
1. docs/frontend/stage-3k-lovable-suggestions-backlog.md exists.
2. The backlog has Accepted, Deferred, Rejected, and Done triage states.
3. The current backlog records PatientsPage PRs #18-#21 as Done.
4. Real patient creation/deletion is Deferred, not implemented.

Do not rewrite or regenerate files. Report sync conflicts only.
```

## 7. Triage checklist template

Use this checklist when Lovable returns extra implementation ideas after
a sync confirmation:

```text
Lovable suggestions received:
- <suggestion 1>
- <suggestion 2>

Triage:
- Accepted:
  - <small, safe item to implement in the next Codex PR>
- Deferred:
  - <item blocked by backend persistence, permissions, audit, design, or release timing>
- Rejected:
  - <item that conflicts with constraints or duplicates existing behavior>
- Done:
  - <item already implemented and confirmed>

Implementation scope for next PR:
- <one accepted item or one tightly related group>

Guardrails:
- no real patient data mutation unless owned by a backend stage;
- no clipboard/file-system APIs;
- no `localStorage` or `sessionStorage`;
- no direct doctor UI `fetch` calls;
- no secrets, signed URLs, storage paths, or service-role keys.
```

## 8. UX review: patient create-delete triage

Current UX decision: do not expose real patient creation or real patient
deletion controls in the doctor UI until a backend/persistence stage owns
the full workflow.

Rationale:

- A real creation form would invite entry of identifiable patient data
  while the current screen still operates in demo/local mode.
- A real delete action is clinically and operationally high-risk unless
  retention, recovery, audit, and permission rules are defined first.
- Tests for real create/delete should assert backend contracts, not only
  front-end click paths. They belong with the persistence implementation.
- Current demo/local affordances are intentionally explicit: creation is
  non-mutating, edit/delete are local-only, and status/change-log copy
  tells the user what happened.
- Adding backend-looking controls before backend ownership would reduce
  user trust because the UI would imply durability that does not exist.

UX acceptance for the current stage:

- Keep `Новый пациент` as a non-mutating demo affordance.
- Keep local delete reversible through the existing undo flow.
- Keep real patient creation, real deletion, backend wiring, and
  real-flow error logging in `Deferred`.
- Revisit these items only when a backend/persistence stage defines API
  contracts, permissions, audit, consent, recovery, and error handling.
