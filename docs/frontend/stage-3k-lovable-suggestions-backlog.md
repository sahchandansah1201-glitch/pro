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
| LV-005 | Real patient creation and backend persistence | Deferred | Repeated by Lovable after PR #22; still requires a dedicated backend/persistence stage with role permissions, audit, consent rules, and real data handling. |
| LV-006 | Real patient deletion | Deferred | Repeated by Lovable after PR #22; still requires backend ownership, irreversible-action policy, audit trail, and recovery/retention rules. |
| LV-007 | Bulk patient operations | Deferred | Needs a separate workflow design; avoid mixing with table convenience work. |
| LV-008 | Triage checklist template for future Lovable suggestions | Done | Added in PR #23 so each suggestion is classified before it becomes implementation scope. |

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
