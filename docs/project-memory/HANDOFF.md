# HANDOFF

## Scope

This handoff captures the repository state while Stage 9N-9Z is being
merged from branch `codex/stage9n-9z-device-bridge-lifecycle-assurance`.

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
12. Stage 8J-8O implements Device Bridge production readiness and the server
    operations handbook:
   - Stage 8J: self-hosted `GET /api/v1/device-bridge-worker/production-readiness`;
   - Stage 8K: production readiness panel in `/sys/devices`;
   - Stage 8L: drift guard, OpenAPI, workflow and preflight;
   - Stage 8M: server operations handbook manifest;
   - Stage 8N: handbook renderer and Lovable sync prompt;
   - Stage 8O: handbook guard and project-memory update.
13. Stage 8J-8O product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in the readiness report or handbook.
14. Stage 8P-9A implements Device Bridge operations continuity:
   - Stage 8P: incident drill register;
   - Stage 8Q: telemetry retention register;
   - Stage 8R: continuity checklist;
   - Stage 8S: self-hosted `GET /api/v1/device-bridge-worker/operations-continuity`;
   - Stage 8T: OpenAPI and nginx publishing;
   - Stage 8U: frontend continuity adapter;
   - Stage 8V: `/sys/devices` continuity UI;
   - Stage 8W: safe export preview;
   - Stage 8X: drift guard;
   - Stage 8Y: workflow gate;
   - Stage 8Z: project-memory refresh;
   - Stage 9A: next batch handoff.
15. Stage 8P-9A product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in continuity reports.
16. Stage 9B-9M implements Device Bridge fleet reliability:
   - Stage 9B: fleet reliability register;
   - Stage 9C: worker SLO policy;
   - Stage 9D: command queue SLO policy;
   - Stage 9E: self-hosted `GET /api/v1/device-bridge-worker/fleet-reliability`;
   - Stage 9F: OpenAPI and nginx publishing;
   - Stage 9G: frontend reliability adapter;
   - Stage 9H: `/sys/devices` fleet reliability UI;
   - Stage 9I: safe reliability export preview;
   - Stage 9J: drift guard;
   - Stage 9K: workflow gate;
   - Stage 9L: project-memory refresh;
   - Stage 9M: next batch handoff.
17. Stage 9B-9M product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in reliability reports.
18. Stage 9N-9Z implements Device Bridge lifecycle assurance:
   - Stage 9N: lifecycle assurance register;
   - Stage 9O: maintenance window policy;
   - Stage 9P: worker upgrade posture;
   - Stage 9Q: audit retention closure;
   - Stage 9R: self-hosted `GET /api/v1/device-bridge-worker/lifecycle-assurance`;
   - Stage 9S: OpenAPI and nginx publishing;
   - Stage 9T: frontend assurance adapter;
   - Stage 9U: `/sys/devices` lifecycle assurance UI;
   - Stage 9V: safe closure export preview;
   - Stage 9W: drift guard;
   - Stage 9X: workflow gate;
   - Stage 9Y: project-memory refresh;
   - Stage 9Z: next batch handoff.
19. Stage 9N-9Z product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in lifecycle assurance reports.
20. Stage 10A-10Z implements error prevention and x2 batch quality gates:
   - Stage 10A: error taxonomy register;
   - Stage 10B: pre-implementation repository state gate;
   - Stage 10C: batch size compliance gate;
   - Stage 10D: manifest-to-docs alignment gate;
   - Stage 10E: package script alignment gate;
   - Stage 10F: preflight-all alignment gate;
   - Stage 10G: project-memory post-merge wording gate;
   - Stage 10H: Lovable prompt timing gate;
   - Stage 10I: temporary artifact detection gate;
   - Stage 10J: lockfile integrity gate;
   - Stage 10K: boundary marker guard;
   - Stage 10L: typecheck before PR gate;
   - Stage 10M: stage-specific preflight gate;
   - Stage 10N: previous-batch regression gate;
   - Stage 10O: UI fetch-count drift gate;
   - Stage 10P: shared UI type drift gate;
   - Stage 10Q: dry-run output hygiene gate;
   - Stage 10R: GitHub check wait gate;
   - Stage 10S: post-merge local main verification gate;
   - Stage 10T: Lovable sync mismatch diagnostic gate;
   - Stage 10U: failure-to-prevention worklog gate;
   - Stage 10V: mandatory command bundle;
   - Stage 10W: Pull request evidence bundle;
   - Stage 10X: CI workflow gate;
   - Stage 10Y: project-memory refresh;
   - Stage 10Z: next x2 batch handoff.
21. Stage 10A-10Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository metadata only.

## Important operational fact

The Lovable sync prompt remains valid only after the Pull request is merged
into `main` and local `main` is verified. A prompt for an open PR branch is
expected to produce a false "missing files" result because Lovable follows
`main` unless branch switching is explicitly enabled.

## Hypothesis

- `Stage 10A-10Z` is the confirmed process batch after Stage 9N-9Z.
- `Stage 11A-11Z` is the next likely batch after Stage 10A-10Z.
- Historical marker: `Stage 10A-10L` was the original next hypothesis after
  Stage 9N-9Z before the x2 batch expanded into Stage 10A-10Z.
- Historical marker: `Stage 8P-8R` was the original next hypothesis after
  Stage 8J-8O before the x2 batch expanded into Stage 8P-9A.
- Historical marker: `Stage 9B-9D` was the original next hypothesis after
  Stage 8P-9A before this x2 batch expanded into Stage 9B-9M.
- Historical marker: `Stage 8J-8L` was the original roadmap hypothesis after
  Stage 8G-8I before the batch-size increase combined it with Stage 8M-8O.

## Immediate continuation recommendation

1. Complete the Stage 10A-10Z Pull request lifecycle.
2. Run or verify:
   - `npm run preflight:stage10a-10z`
   - `npm run preflight:stage9n-9z`
   - `npm run check:project-memory`
   - `npm run test:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future product batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.
