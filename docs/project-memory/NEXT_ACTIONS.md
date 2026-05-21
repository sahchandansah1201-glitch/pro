# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 9B-9M as one x2 Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 9B-9M implementation**:
   - convert the previous Stage 9B-9D hypothesis into a larger Device Bridge
     fleet reliability batch with backend endpoint, UI, OpenAPI, guard,
     workflow, docs, and project-memory;
   - do not expose raw worker payloads, raw result payloads, signed URLs,
     storage paths, tokens, raw patient names, Supabase markers, browser
     hardware APIs, or managed runtime/database dependencies.

2. **Verify before commit**:
   - `npm run test:stage9b-9m`
   - `npm run check:stage9b-9m`
   - `npm run reliability:stage9b-9m:dry-run`
   - `npm run preflight:stage9b-9m`
   - `npm run preflight:stage8p-9a`
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

## Stage 9B-9M current batch

Stage 9B-9M is the current x2 product batch after Stage 8P-9A. It closes the
earlier Stage 9B-9D hypothesis by defining Device Bridge fleet reliability in
repository files.

Historical roadmap anchor: Stage 8P-9A is the current x2 Device Bridge
operations continuity batch. It expands the previous six-stage batch to
twelve related stages in one Pull request and recorded Stage 9B-9D as the
next hypothesis before Stage 9B-9M defined the actual scope.

## Stage 9N-9Z hypothesis

Stage 9N-9Z is the next likely product batch after Stage 9B-9M. Its current
scope has not been defined in repository files, so it remains a hypothesis
until repository files define it.

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
