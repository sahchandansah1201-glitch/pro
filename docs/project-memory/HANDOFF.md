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
22. Stage 11A-11Z implements development quality ledger:
   - Stage 11A: batch intake ledger;
   - Stage 11B: repository evidence ledger;
   - Stage 11C: scope-to-file ownership ledger;
   - Stage 11D: required check matrix;
   - Stage 11E: previous-batch regression matrix;
   - Stage 11F: defect capture ledger;
   - Stage 11G: prevention verification ledger;
   - Stage 11H: temporary artifact quarantine ledger;
   - Stage 11I: lockfile integrity ledger;
   - Stage 11J: typecheck and shared type ledger;
   - Stage 11K: UI endpoint drift ledger;
   - Stage 11L: OpenAPI and route alignment ledger;
   - Stage 11M: workflow and CI alignment ledger;
   - Stage 11N: project-memory confirmation ledger;
   - Stage 11O: historical guard compatibility ledger;
   - Stage 11P: Lovable prompt sequencing ledger;
   - Stage 11Q: GitHub checks waiting ledger;
   - Stage 11R: post-merge local main ledger;
   - Stage 11S: sync mismatch recovery ledger;
   - Stage 11T: batch volume metrics ledger;
   - Stage 11U: risk and uncertainty ledger;
   - Stage 11V: artifact link ledger;
   - Stage 11W: boundary and privacy ledger;
   - Stage 11X: Pull request evidence ledger;
   - Stage 11Y: Lovable verification manifest ledger;
   - Stage 11Z: next x2 batch handoff ledger.
23. Stage 11A-11Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository quality metadata only.
24. Stage 12A-12Z implements the execution evidence bundle:
   - Stage 12A: evidence bundle schema;
   - Stage 12B: repository baseline evidence;
   - Stage 12C: branch and commit evidence;
   - Stage 12D: scope ownership evidence;
   - Stage 12E: command bundle evidence;
   - Stage 12F: previous-batch regression evidence;
   - Stage 12G: defect recurrence evidence;
   - Stage 12H: prevention proof evidence;
   - Stage 12I: preflight-all alignment evidence;
   - Stage 12J: project-memory alignment evidence;
   - Stage 12K: typecheck evidence;
   - Stage 12L: lockfile and temp artifact evidence;
   - Stage 12M: boundary scan evidence;
   - Stage 12N: privacy scan evidence;
   - Stage 12O: workflow and CI evidence;
   - Stage 12P: GitHub check-run evidence;
   - Stage 12Q: GitHub API fallback evidence;
   - Stage 12R: Pull request evidence;
   - Stage 12S: merge evidence;
   - Stage 12T: post-merge local main evidence;
   - Stage 12U: Lovable prompt evidence;
   - Stage 12V: Lovable confirmation evidence;
   - Stage 12W: sync mismatch recovery evidence;
   - Stage 12X: risk roll-forward evidence;
   - Stage 12Y: batch volume evidence;
   - Stage 12Z: next x2 execution handoff evidence.
25. Stage 12A-12Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository execution evidence only.
26. Stage 13A-13Z implements the execution evidence closure:
   - Stage 13A: closure schema;
   - Stage 13B: Stage 12 evidence regression;
   - Stage 13C: closure rule register;
   - Stage 13D: prompt sequencing closure;
   - Stage 13E: Pull request lifecycle closure;
   - Stage 13F: Lovable sync closure;
   - Stage 13G: sync mismatch diagnostic closure;
   - Stage 13H: artifact hygiene closure;
   - Stage 13I: project-memory closure;
   - Stage 13J: working contract closure;
   - Stage 13K: batch template closure;
   - Stage 13L: preflight-all closure;
   - Stage 13M: typecheck closure;
   - Stage 13N: no-lock-file closure;
   - Stage 13O: diff hygiene closure;
   - Stage 13P: guard coverage closure;
   - Stage 13Q: workflow closure;
   - Stage 13R: report output closure;
   - Stage 13S: self-hosted boundary closure;
   - Stage 13T: privacy closure;
   - Stage 13U: command repeatability closure;
   - Stage 13V: defect-prevention closure;
   - Stage 13W: post-merge verification closure;
   - Stage 13X: Lovable prompt source closure;
   - Stage 13Y: batch volume closure;
   - Stage 13Z: next x2 handoff closure.
27. Stage 13A-13Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository closure evidence only.
28. Stage 14A-14Z implements the sync confirmation ledger:
   - Stage 14A: sync ledger schema;
   - Stage 14B: Lovable confirmation evidence;
   - Stage 14C: merged main evidence;
   - Stage 14D: Pull request lifecycle ledger;
   - Stage 14E: GitHub checks ledger;
   - Stage 14F: command outcome ledger;
   - Stage 14G: sync mismatch decision tree;
   - Stage 14H: branch visibility diagnostic;
   - Stage 14I: artifact hygiene ledger;
   - Stage 14J: project-memory confirmation;
   - Stage 14K: working contract enforcement;
   - Stage 14L: batch template enforcement;
   - Stage 14M: previous batch regression;
   - Stage 14N: preflight-all alignment;
   - Stage 14O: typecheck and lockfile alignment;
   - Stage 14P: package-lock immutability;
   - Stage 14Q: prompt release gate;
   - Stage 14R: Lovable response gate;
   - Stage 14S: self-hosted boundary ledger;
   - Stage 14T: privacy marker ledger;
   - Stage 14U: duplicate CI run handling;
   - Stage 14V: long gate handling;
   - Stage 14W: risk rollback ledger;
   - Stage 14X: next batch readiness;
   - Stage 14Y: handoff packet;
   - Stage 14Z: Stage 15 hypothesis.
29. Stage 14A-14Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository sync evidence only.
30. Stage 15A-15Z implements the post-sync handoff readiness packet:
   - Stage 15A: previous sync confirmation intake;
   - Stage 15B: merged main replay evidence;
   - Stage 15C: Lovable prompt replay evidence;
   - Stage 15D: Pull request merge audit;
   - Stage 15E: GitHub checks replay audit;
   - Stage 15F: duplicate CI resolution rule;
   - Stage 15G: long gate wait policy;
   - Stage 15H: sync mismatch classifier;
   - Stage 15I: repository remote alignment;
   - Stage 15J: Lovable project alignment;
   - Stage 15K: artifact path normalization;
   - Stage 15L: project-memory handoff refresh;
   - Stage 15M: working contract refresh;
   - Stage 15N: batch template replay;
   - Stage 15O: Stage 14 regression gate;
   - Stage 15P: command bundle freeze;
   - Stage 15Q: preflight-all readiness check;
   - Stage 15R: typecheck baseline confirmation;
   - Stage 15S: no-lock-file hygiene;
   - Stage 15T: package-lock immutability;
   - Stage 15U: privacy marker scan;
   - Stage 15V: self-hosted boundary assertion;
   - Stage 15W: prompt release checklist;
   - Stage 15X: Lovable response checklist;
   - Stage 15Y: defect recurrence ledger;
   - Stage 15Z: Stage 16 hypothesis handoff.
31. Stage 15A-15Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository post-sync handoff evidence only.
32. Stage 16A-16Z implements product cycle readiness:
   - Stage 16A: post-sync baseline intake;
   - Stage 16B: product surface inventory;
   - Stage 16C: process-only batch stop rule;
   - Stage 16D: product candidate scoring;
   - Stage 16E: recommended product candidate:
     `Clinical follow-up and patient communication loop`;
   - Stage 16F: acceptance criteria outline;
   - Stage 16G: Lovable prompt gate;
   - Stage 16H-16M: verification, boundary, and project-memory alignment;
   - Stage 16N-16Z: Product-cycle handoff and Stage 17A-17Z hypothesis.
33. Stage 16A-16Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository product cycle readiness only.

## Important operational fact

The Lovable sync prompt remains valid only after the Pull request is merged
into `main` and local `main` is verified. A prompt for an open PR branch is
expected to produce a false "missing files" result because Lovable follows
`main` unless branch switching is explicitly enabled.

## Hypothesis

- `Stage 10A-10Z` is the confirmed process batch after Stage 9N-9Z.
- `Stage 15A-15Z` is the confirmed post-sync handoff readiness batch after Stage 14A-14Z.
- `Stage 16A-16Z` is the current product cycle readiness batch after Stage 15A-15Z.
- `Stage 17A-17Z` is the next product-facing hypothesis after Stage 16A-16Z.
- Historical marker: `Stage 10A-10L` was the original next hypothesis after
  Stage 9N-9Z before the x2 batch expanded into Stage 10A-10Z.
- Historical marker: `Stage 8P-8R` was the original next hypothesis after
  Stage 8J-8O before the x2 batch expanded into Stage 8P-9A.
- Historical marker: `Stage 9B-9D` was the original next hypothesis after
  Stage 8P-9A before this x2 batch expanded into Stage 9B-9M.
- Historical marker: `Stage 8J-8L` was the original roadmap hypothesis after
  Stage 8G-8I before the batch-size increase combined it with Stage 8M-8O.

## Immediate continuation recommendation

1. Complete the Stage 16A-16Z Pull request lifecycle.
2. Run or verify:
   - `npm run preflight:stage16a-16z`
   - `npm run preflight:stage15a-15z`
   - `npm run check:project-memory`
   - `npm run test:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future product batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.

## Stage 17A-17Z confirmed product cycle

Stage 17A-17Z implements the clinical follow-up and patient communication loop selected by Stage 16A-16Z:

- doctors create visit follow-up tasks through `VisitWorkspaceLiveActions`;
- the self-hosted backend stores follow-up tasks and messages in PostgreSQL;
- staff use RBAC-protected `/api/v1/clinical/follow-ups` contracts;
- patients use `/api/v1/me/follow-ups` and patient-safe replies through the portal;
- patient-facing responses hide internal notes, object storage paths, signed URLs, and raw infrastructure values.

Product boundary: self-hosted Node backend, self-hosted PostgreSQL, no managed runtime, no managed database, and no managed notification provider dependency.

## Stage 17A-17Z verification

- `npm run test:stage17a-17z`
- `npm run check:stage17a-17z`
- `npm run preflight:stage17a-17z`

## Stage 18A-18Z hypothesis

Stage 18A-18Z is the next hypothesis after Stage 17A-17Z. The exact scope is not confirmed until repository files define it.
