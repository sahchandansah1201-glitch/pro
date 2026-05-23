# NEXT_ACTIONS

## Current confirmed state

Stage 21A-21Z is the current product-facing batch. It extends the Stage 20A-20Z clinical follow-up retention and clinic review layer with local clinic-specific SOP validation for follow-up state transitions.

## Immediate actions after Stage 21A-21Z PR merge

1. Verify local `main` after merge:
   - `git status --short`
   - `npm run preflight:stage21a-21z`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
2. Send the Lovable sync prompt only after the PR is merged into `main` and local `main` is verified.
3. Expected Lovable confirmation:
   - `Confirmed: Stage 21A-21Z synced from main, no conflicts.`

## Next hypothesis

Stage 22A-22Z is a hypothesis until repository files define it. The most likely next product cycle is configurable clinic SOP policy templates for the Stage 21A-21Z validation states.

## Historical anchors

Stage 7A-7C, Stage 7D-7F, Stage 7G-7I, and Stage 7J-7L remain historical batch-workflow and roadmap anchors. Stage 7A-7C also remains the workflow-contract anchor for the minimum three related stages rule per Pull request. Stage 8A-8C, Stage 8D-8F, Stage 8G-8I, Stage 8J-8L, Stage 8J-8O, Stage 8P-8R, Stage 8P-9A, Stage 9B-9D, Stage 9B-9M, and Stage 9N-9Z remain historical product and Device Bridge anchors.

Stage 10A-10L remains the historical hypothesis that was expanded into Stage 10A-10Z. Stage 10A-10Z remains the confirmed error-prevention batch before Stage 11A-11Z development quality. Stage 11A-11Z remains the confirmed quality-ledger batch before Stage 12A-12Z execution evidence. Stage 12A-12Z remains the confirmed execution evidence bundle before Stage 13A-13Z execution evidence closure. Stage 13A-13Z remains the confirmed execution evidence closure before Stage 14A-14Z sync confirmation ledger. Stage 14A-14Z remains the confirmed sync confirmation ledger before Stage 15A-15Z post-sync handoff readiness.

Stage 15A-15Z remains the confirmed post-sync handoff readiness batch before Stage 16A-16Z product cycle readiness. Stage 16A-16Z selected Stage 17A-17Z as the recommended product candidate, and Stage 17A-17Z closes that hypothesis with code.

Stage 18A-18Z remains the confirmed follow-up operations hardening batch after Stage 17A-17Z. Stage 19A-19Z remains the confirmed follow-up outcome quality batch after Stage 18A-18Z. Stage 20A-20Z closes the previous Stage 20A-20Z hypothesis with retention and clinic review readiness. Stage 21A-21Z closes the previous Stage 21A-21Z hypothesis with clinic-specific SOP validation.
