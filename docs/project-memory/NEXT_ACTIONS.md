# NEXT_ACTIONS

## Highest-confidence next step

Merge and verify Stage 14A-14Z as one x2 Pull request, then send the Lovable
sync prompt only after `main` contains the merged sync confirmation ledger.

## Immediate sequence

1. **Complete the Stage 14A-14Z Pull request lifecycle**:
   - commit the sync confirmation ledger with manifest, renderer, guard,
     workflow, docs, project-memory, and preflight-all wiring;
   - do not send the Lovable prompt before the PR is merged into `main` and
     local `main` is verified.

2. **Verify before commit**:
   - `npm run test:stage14a-14z`
   - `npm run check:stage14a-14z`
   - `npm run ledger:stage14a-14z:dry-run`
   - `npm run preflight:stage14a-14z`
   - `npm run preflight:stage13a-13z`
   - `npm run typecheck`
   - `npm run test:project-memory`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`

3. **Complete the Pull request lifecycle**:
   - commit and push the branch;
   - create the Pull request;
   - wait for checks;
   - merge into `main`;
   - verify local `main`;
   - only then send Lovable the sync prompt.

4. **Use the product roadmap for the next implementation phase**:
   - minimum three related stages per Pull request;
   - smaller PRs require a documented reason: urgent CI fix, security fix,
     single-file typo, or hotfix.

## Stage 12A-12Z current batch

Stage 12A-12Z is the current x2 process batch after Stage 11A-11Z. It defines
the execution evidence bundle for implementation, diagnostics, verification,
GitHub lifecycle evidence, Lovable handoff evidence, sync mismatch recovery,
and next x2 handoff evidence.

The batch keeps 26 related stages in one Pull request and records Stage
13A-13Z as the next hypothesis until repository files define the next scope.

## Stage 11A-11Z historical batch

Stage 11A-11Z is the current x2 process batch after Stage 10A-10Z. It defines
the development quality ledger for batch intake, diagnostics, verification,
handoff evidence, historical guard compatibility, and post-merge Lovable sync
sequencing.

The batch keeps 26 related stages in one Pull request and recorded Stage
12A-12Z as the next hypothesis before Stage 12A-12Z defined the actual scope.

## Stage 10A-10Z historical batch

Stage 10A-10Z is the confirmed x2 process batch after Stage 9N-9Z. It closes
the earlier Stage 10A-10L hypothesis by defining a 26-stage error-prevention
and batch-quality gate in repository files.

The batch converts repeated defects into prevention rules:

- UI fetch-count drift;
- shared UI type drift;
- preflight-all drift;
- temporary dry-run artifacts;
- project-memory post-merge wording drift;
- GitHub GraphQL timeout fallback.

## Stage 9N-9Z historical batch

Stage 9N-9Z is the confirmed x2 product batch after Stage 9B-9M. It closes the
earlier Stage 9N-9Z hypothesis by defining Device Bridge lifecycle assurance in
repository files.

Historical roadmap anchor: Stage 9B-9M is the confirmed x2 Device Bridge
fleet reliability batch. It expanded the previous Stage 9B-9D hypothesis and
recorded Stage 9N-9Z as the next batch before Stage 9N-9Z defined the actual
scope.

Historical roadmap anchor: Stage 8P-9A is the confirmed x2 Device Bridge
operations continuity batch. It expands the previous six-stage batch to
twelve related stages in one Pull request and recorded Stage 9B-9D as the
next hypothesis before Stage 9B-9M defined the actual scope.

## Stage 13A-13Z historical batch

Stage 13A-13Z is the confirmed x2 process batch after Stage 12A-12Z. It defines
the execution evidence closure for schema, previous evidence regression,
verification, GitHub lifecycle, Lovable prompt sequencing, sync mismatch
diagnostics, artifact hygiene, project-memory closure, and next x2 handoff.

The batch kept 26 related stages in one Pull request and recorded Stage
14A-14Z as the next hypothesis before Stage 14A-14Z defined the actual scope.

## Stage 14A-14Z current batch

Stage 14A-14Z is the current x2 process batch after Stage 13A-13Z. It defines
the sync confirmation ledger for confirmed previous Lovable sync, merged main
evidence, Pull request lifecycle, duplicate CI handling, sync mismatch
diagnostics, artifact hygiene, project-memory confirmation, prompt release
gates, and next x2 handoff.

The batch keeps 26 related stages in one Pull request and records Stage
15A-15Z as the next hypothesis until repository files define the next scope.

## Stage 15A-15Z hypothesis

Stage 15A-15Z is the next likely batch after Stage 14A-14Z. Its current scope
has not been defined in repository files, so it remains a hypothesis until
repository files define it.

Historical note: Stage 7G-7I is complete and introduced the batch verification
loop that Stage 7J-7L now uses for product-roadmap planning. Stage 7D-7F
remains the confirmed batch automation contract and Lovable prompt gate
foundation.

Historical roadmap anchor: Stage 8A-8C is complete and remains the confirmed
CRM inbound adapter batch that Stage 7J-7L uses as the original next-product
batch handoff target. Do not remove this historical Stage 8A-8C marker when
updating current next actions.

Historical roadmap anchor: Stage 8D-8F is complete and remains the confirmed
availability sync and booking confirmation readiness batch that made Stage
8G-8I the next clinical reporting batch. Do not remove this historical Stage
8D-8F marker when updating current next actions.

Historical roadmap anchor: Stage 8G-8I is complete and remains the confirmed
clinical reporting completion batch that made Stage 8J-8O the next Device
Bridge and operations handbook batch. Do not remove this historical Stage
8G-8I marker when updating current next actions.

Historical roadmap marker: Stage 8J-8L was the original Device Bridge
production hardening hypothesis after Stage 8G-8I. It is preserved for
backward-compatible guards; the current x2 batch implements it together with
Stage 8M-8O as Stage 8J-8O.

Historical roadmap marker: Stage 8P-8R was the original Device Bridge
operations continuity hypothesis after Stage 8J-8O. It is preserved for
backward-compatible guards; the current x2 batch expands that scope through
Stage 9A as Stage 8P-9A.
