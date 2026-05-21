# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 8J-8O as one x2 Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 8J-8O implementation**:
   - keep the scope focused on Device Bridge production readiness and the
     server operations handbook;
   - do not expose raw worker payloads, raw result payloads, signed URLs,
     storage paths, tokens, raw patient names, Supabase markers, browser
     hardware APIs, or managed runtime/database dependencies.

2. **Verify before commit**:
   - `npm run test:stage8j-8o`
   - `npm run check:stage8j-8o`
   - `npm run handbook:stage8m-8o:dry-run`
   - `npm run preflight:stage8j-8o`
   - `npm run preflight:stage4y`
   - `npm run preflight:stage8g-8i`
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

## Stage 8P-8R hypothesis

Stage 8P-8R is the next likely product batch after Stage 8J-8O. Its current
scope has not been defined in repository files, so it remains a
hypothesis until repository files define it.

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
