# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 7G-7I as one Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 7G-7I implementation**:
   - Keep the scope limited to readiness reporter, Lovable sync verification
     manifest, drift guard, CI guard, and preflight wiring.
   - Do not change product runtime behavior in this stage.

2. **Verify before commit**:
   - `npm run test:stage7g-7i`
   - `npm run check:stage7g-7i`
   - `npm run readiness:stage7g-7i:dry-run`
   - `npm run preflight:stage7g-7i`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`

3. **Complete the Pull request lifecycle**:
   - Commit and push the branch.
   - Create the Pull request.
   - Wait for checks.
   - Merge into `main`.
   - Verify local `main`.
   - Only then send Lovable the sync prompt.

4. **Apply the batch-size rule going forward**:
   - minimum three related stages per Pull request.
   - Smaller PRs require a documented reason: urgent CI fix, security fix,
     single-file typo, or hotfix.

## Stage 7J hypothesis

Stage 7J is the next likely stage after Stage 7G-7I, but its scope is not
confirmed by repository files yet.

Historical note: Stage 7D-7F is already complete and introduced the batch
automation contract that Stage 7G-7I now verifies.
