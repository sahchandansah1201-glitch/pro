# FINAL_BACKLOG_TERMINAL_COMPLETION

## Purpose

This document defines the final repository backlog and terminal completion
criterion after Stage 48A-48Z. It is not a new clinical runtime stage.

## Terminal Completion Criterion

The current repository plan is terminal when all of the following are true:

1. Stage 48A-48Z is merged to `main` and synchronized from `main`.
2. `deploy/self-hosted/final-backlog-terminal-completion-criterion.json` is
   merged to `main`.
3. `npm run preflight:final-backlog` passes from the repository root.
4. `npm run preflight:all -- --dry-run`, `node scripts/check-no-deno-locks.mjs`,
   and `git diff --check` pass from `main`.
5. No repository file defines Stage 49A-49Z or another automatic next numbered
   batch.
6. Remaining work is classified as external approval, operator acceptance, or
   future product-change intake rather than an active repository stage.

## Final Backlog

1. Lovable main sync: confirm this terminal criterion from `main` after merge.
2. Clinic operator acceptance: approve production workflow use outside git.
3. Legal/compliance review: review legal archive sufficiency, privacy posture,
   and local SOP approval outside repository evidence.
4. Future product-change intake: any future numbered batch or feature requires
   a new explicit plan decision.

## Non-Goals

- This document does not add runtime behavior.
- This document does not add a database migration.
- This document does not add an OpenAPI contract.
- This document does not prove external legal approval, external clinical
  approval, or medical correctness.
- This document does not define Stage 49A-49Z.

## Expected Lovable Confirmation

`Confirmed: final backlog / terminal completion criterion synced from main, no conflicts.`
