# HANDOFF

## Scope

This handoff captures the repository state while Stage 8G-8I is being
implemented on branch `codex/stage8g-8i-clinical-reporting-completion`.

## Confirmed state

1. Stage 6A-6Z and Stage 7A-7I are present on the current branch base.
2. Stage 7A-7C is the development workflow contract.
3. Stage 7D-7F is the batch automation contract and Lovable prompt gate.
4. Stage 7G-7I is the confirmed batch verification loop:
   - readiness reporter;
   - Lovable sync verification manifest;
   - drift guard.
5. Stage 7J-7L adds a product roadmap control layer only:
   - Stage 7J: product gap register.
   - Stage 7K: next product batch planner.
   - Stage 7L: product roadmap drift guard.
6. Stage 8A-8C implements the CRM inbound adapter layer:
   - Stage 8A: CRM inbound adapter contract.
   - Stage 8B: CRM export normalization into Stage 5Q import payloads.
   - Stage 8C: safe import audit flow.
7. Stage 8A-8C product boundary:
   - no backend route changes;
   - no database migrations;
   - no frontend runtime pages;
   - no managed runtime or managed database dependency;
   - no browser/backend runtime calls to CRM or advertising systems.
8. Stage 8D-8F implements the appointment availability sync layer:
   - Stage 8D: local availability sync snapshot contract;
   - Stage 8E: conflict/readiness detection for stale, duplicate,
     overlapping, unmatched, and rejected import states;
   - Stage 8F: booking confirmation readiness that maps local request refs to
     local slot refs for the existing Stage 5S confirmation flow.
9. Stage 8D-8F product boundary:
   - no CRM/ad runtime calls;
   - no managed runtime or managed database dependency;
   - no raw patient identity, token, external URL, signed URL, or storage path
     output in reports or UI;
   - operator UI reads already-loaded self-hosted Stage 5P/5R/5T data.
10. Stage 8G-8I implements Clinical reporting completion:
   - Stage 8G: self-hosted `GET /api/v1/visits/{visitId}/report-package`;
   - Stage 8H: readiness gates for assessment, conclusion, report, lesion,
     and asset completeness;
   - Stage 8I: production report-tab summary in `VisitWorkspacePage`.
11. Stage 8G-8I product boundary:
   - no managed runtime or managed database dependency;
   - no external CRM/ad/scheduling runtime calls;
   - no browser hardware API coupling;
   - no raw patient report body, signed URL, object storage path, or token
     output in the report package.

## Important operational fact

The Lovable sync prompt remains valid only after the Pull request is merged
into `main` and local `main` is verified. A prompt for an open PR branch is
expected to produce a false "missing files" result because Lovable follows
`main` unless branch switching is explicitly enabled.

## Hypothesis

- `Stage 8J-8L` is the next likely product batch after Stage 8G-8I.

## Immediate continuation recommendation

1. Finish Stage 8G-8I in one Pull request.
2. Run:
   - `npm run preflight:stage8g-8i`
   - `npm run preflight:stage5h`
   - `npm run preflight:stage5g`
   - `npm run check:project-memory`
   - `npm run test:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future product batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.
