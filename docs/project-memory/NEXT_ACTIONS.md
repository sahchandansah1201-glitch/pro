# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 8G-8I as one Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 8G-8I implementation**:
   - keep the scope focused on the self-hosted clinical report-package
     readiness contract, backend RBAC/audit, production report-tab summary,
     OpenAPI, guard, CI guard, and preflight wiring;
   - do not expose raw report body text, signed URLs, object storage paths,
     tokens, raw patient identifiers, or external runtime calls.

2. **Verify before commit**:
   - `npm run test:stage8g-8i`
   - `npm run check:stage8g-8i`
   - `npm run preflight:stage8g-8i`
   - `npm run preflight:stage5h`
   - `npm run preflight:stage5g`
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

## Stage 8J-8L hypothesis

Stage 8J-8L is the next likely product batch after Stage 8G-8I. Its current
roadmap scope is Device Bridge production hardening, but it remains a
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
