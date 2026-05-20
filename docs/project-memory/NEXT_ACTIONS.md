# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 7A-7C as one Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 7A-7C implementation**:
   - Keep the scope limited to workflow contract, batch-size guard, batch
     planning template, project-memory updates, CI guard, and preflight wiring.
   - Do not change product runtime behavior in this stage.

2. **Verify before commit**:
   - `npm run test:stage7a-7c`
   - `npm run check:stage7a-7c`
   - `npm run preflight:stage7a-7c`
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

## Stage 7D hypothesis

Stage 7D is the next likely stage after Stage 7A-7C, but its scope is not
confirmed by repository files yet.
