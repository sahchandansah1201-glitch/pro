# WORKING_CONTRACT

## Scope

Stage 7A-7C records the working contract for future development of Dermatolog
Pro. This is a process contract, not a product runtime change.

## Stage 7A: Pull request lifecycle

The required order for Codex-led development is:

1. Create or use a `codex/` branch from `main`.
2. Implement the scoped batch.
3. Run the relevant local checks.
4. Commit the scoped files.
5. Push the branch to GitHub.
6. Create the Pull request.
7. Wait for checks and inspect failures if they appear.
8. Merge the passing Pull request into `main`.
9. Verify local `main` contains the merged files and stage preflight passes.
10. Only then send the Lovable sync confirmation prompt.

Lovable sync prompts are invalid while the stage exists only in an open Pull
request. Lovable follows `main` unless branch switching is explicitly enabled.

## Stage 7B: Batch size rule

Future work defaults to larger related batches:

- Minimum related stages per Pull request: `3`.
- A smaller Pull request must state one of these reasons:
  - urgent CI fix
  - security fix
  - single-file typo
  - hotfix
- If no reason applies, combine the next related stages into one Pull request.

This rule is meant to avoid repeated small sync cycles and repeated Lovable
prompts for tightly coupled work.

## Stage 7C: Batch planning rule

Before starting a future batch, fill the batch template enough to answer:

- Which stages are included.
- Why they belong in one Pull request.
- Which files and product boundaries are expected to change.
- Which checks must pass before merge.
- What exact Lovable prompt will be sent after merge.
- How sync mismatches will be diagnosed.

## Stage 7D: Batch manifest rule

Every normal multi-stage PR must have a repository manifest before the Lovable
sync prompt is considered valid. The manifest records:

- included stages;
- why the stages belong in one Pull request;
- required checks;
- product-boundary claims;
- Lovable prompt timing;
- the next-stage hypothesis.

## Stage 7E: Lovable prompt gate

Lovable prompt gate requirements:

1. Pull request is merged into `main`.
2. Local branch is `main`.
3. Local `main` contains the merged files.
4. Stage preflight passes on local `main`.
5. Project-memory guard passes on local `main`.
6. `node scripts/check-no-deno-locks.mjs` passes.

If any gate is missing, the Lovable prompt is blocked.

## Stage 7F: Project-memory refresh rule

Each completed batch must refresh the project-memory black box before the PR is
merged. At minimum:

- `PROJECT_STATE.yaml` records the new confirmed stage and next hypothesis;
- `HANDOFF.md` summarizes the confirmed state;
- `WORKLOG.md` records the batch;
- `NEXT_ACTIONS.md` points to the next hypothesis, not the completed batch;
- `RISKS.md` carries forward unresolved process risks;
- `ARTIFACTS.md` links the new manifest, docs, scripts, tests, and workflow.

## Stage 7G: Batch readiness reporter

Each larger batch should have a dry-run readiness reporter that makes the
current handoff state explicit before a Lovable prompt is written. The reporter
must show:

- included stages;
- required checks;
- blocked gates;
- product-boundary claims;
- generated post-merge Lovable prompt.

## Stage 7H: Lovable sync verification manifest

The Lovable sync prompt should be generated from repository-owned manifest data,
not written from memory. The manifest must list the files, commands, expected
confirmation text, no-lock expectations, and package-lock expectation that
Lovable should verify after merge into `main`.

## Stage 7I: Batch drift guard

Each batch needs a drift guard that compares:

- manifest;
- reporter exports;
- docs;
- workflow;
- package scripts;
- `preflight-all` label;
- project-memory confirmed stage and next hypothesis.

The guard should fail when these artifacts no longer describe the same batch.

## Stage 10A: Error taxonomy register

Repeated defects are no longer treated as isolated events. Each repeated
defect must be assigned an id, a source batch, a concrete symptom, and a
prevention mechanism.

## Stage 10B: Pre-implementation repository state gate

Before coding a normal batch, verify the branch, HEAD, working tree status,
project-memory state, and latest confirmed stage. Do not begin from chat memory
alone.

## Stage 10C: x2 batch size compliance gate

The default batch target after Stage 9N-9Z is 26 related stages in one Pull
request. Smaller batches require a written hotfix, security fix, urgent CI fix,
or single-file typo reason.

## Stage 10D: Manifest-to-docs alignment gate

The manifest, docs, workflow, package scripts, preflight-all, and
project-memory must describe the same batch id, included stages, next
hypothesis, required checks, and Lovable confirmation.

## Stage 10E: Failure-to-prevention rule

Every diagnosed failure must create a prevention rule or guard before the
batch is handed to Lovable. A fix without a prevention mechanism is incomplete
when the failure class is repeatable.

## Stage 10F: Temporary artifact hygiene

Dry-run output, local `var/` folders, untracked `deno.lock`, and accidental
test reports must be removed or intentionally documented before staging.

## Stage 10G: Type and UI drift prevention

When a batch adds a frontend endpoint or metric to an existing UI, update
request-count assertions, endpoint-specific tests, and shared display types in
the same Pull request.

## Stage 10H: GitHub API fallback rule

If `gh` GraphQL status calls time out, use REST check-runs and continue waiting
for checks. Do not use an API timeout as a reason to send the Lovable prompt
early.

## Stage 10I: Post-merge project-memory wording gate

Before commit, project-memory should already be written for the expected
post-merge state: the current batch is confirmed, and the next batch remains a
hypothesis until repository files define it.

## Stage 10J: Mandatory command bundle

Normal batches must run the stage tests, stage guard, stage dry-run, stage
preflight, previous-batch regression preflight, project-memory guard,
typecheck, preflight-all dry-run, no-deno-locks guard, and `git diff --check`
before the Pull request is merged.

## Stage 10K: Lovable prompt safety

Lovable prompts are generated from repository-owned manifest data. They are
sent only after merge into `main` and local `main` verification.

## Stage 10Z: Next x2 batch handoff

The next normal batch after Stage 10A-10Z is Stage 11A-11Z unless repository
files define a different scope.

## Stage 11A: Batch intake ledger

Stage 11A-11Z creates the Development quality ledger for every large batch.
The intake ledger records branch, base HEAD, included stage range,
same-Pull-request justification, and micro-PR exception status before the
handoff prompt is allowed.

## Stage 11B-11E: Evidence and verification ledgers

Repository evidence, scope-to-file ownership, required checks, and
previous-batch regression must be visible in repository files. The normal
minimum remains 26 related stages after Stage 10A-10Z.

## Stage 11F-11G: Defect and prevention ledgers

Each diagnosed defect must be paired with a prevention rule and a command or
guard that proves the prevention. A fix without a prevention mechanism is not
ready for Lovable handoff when the failure class can repeat.

## Stage 11H-11O: Hygiene and compatibility ledgers

Temporary artifacts, lock files, typecheck drift, route/OpenAPI drift, CI
alignment, project-memory state, and historical guard compatibility remain
part of the batch quality contract.

## Stage 11P-11Y: Handoff ledgers

Lovable prompt sequencing, GitHub checks, post-merge local main verification,
sync mismatch recovery, volume metrics, risk, artifact links, boundary and
privacy, Pull request evidence, and Lovable verification evidence must be
captured before the prompt is sent.

## Stage 11Z: Next x2 batch handoff ledger

The next normal batch after Stage 11A-11Z is Stage 12A-12Z unless repository
files define a different scope.

## Stage 12A: Evidence bundle schema

Stage 12A-12Z creates the Execution evidence bundle for large-batch delivery.
The schema records the branch baseline, included stages, evidence sections,
required checks, evidence rules, product boundary, GitHub lifecycle, and
post-merge Lovable handoff in one repository-owned manifest.

## Stage 12B-12F: Implementation and regression evidence

Implementation evidence must show what was added, which files own the scope,
which command bundle verifies the batch, and which previous batch is regressed
before handoff. Evidence must be concrete repository data, not a chat-only
assertion.

## Stage 12G-12H: Diagnostics and prevention evidence

Every repeatable defect found during implementation must be recorded with a
diagnostic class, a prevention rule, and a command or guard proving the
prevention. If no defect appears, the bundle still records that the diagnostic
pass completed.

## Stage 12I-12P: Verification and GitHub evidence

The batch must capture stage preflight, previous-batch preflight,
project-memory guard, typecheck, full preflight dry-run, lock-file guard,
whitespace guard, workflow presence, Pull request creation, check-run wait,
and ready/merge sequencing.

## Stage 12Q-12W: Handoff and sync evidence

GitHub API fallback, Pull request evidence, merge evidence, post-merge local
main verification, Lovable prompt evidence, Lovable confirmation evidence, and
sync-mismatch recovery evidence must be explicit before the prompt is allowed.

## Stage 12Z: Next x2 execution handoff evidence

The next normal batch after Stage 12A-12Z is Stage 13A-13Z unless repository
files define a different scope.

## Stage 13A: Closure schema

Stage 13A-13Z creates the Execution evidence closure. The schema records the
previous evidence bundle, closure sections, closure rules, required checks,
product boundary, GitHub lifecycle, and post-merge Lovable handoff as a
repository-owned closure package.

## Stage 13B-13F: Previous evidence and prompt closure

The previous Stage 12 evidence bundle must be regressed before the Stage 13
handoff. Prompt sequencing, Pull request lifecycle, Lovable sync, and sync
mismatch diagnostics are closure requirements, not optional notes.

## Stage 13G-13P: Hygiene and verification closure

Artifact hygiene, project-memory updates, working contract updates, batch
template updates, preflight-all wiring, typecheck, lock-file guard, diff
check, and stage guard coverage must all be represented in the closure.

## Stage 13Q-13Y: Boundary and handoff closure

Workflow presence, report output, self-hosted boundary, privacy, command
repeatability, defect prevention, post-merge verification, Lovable prompt
source, and batch volume are required before the prompt can be sent.

## Stage 13Z: Next x2 handoff closure

The next normal batch after Stage 13A-13Z is Stage 14A-14Z unless repository
files define a different scope.

## Stage 14A: Sync ledger schema

Stage 14A-14Z creates the Sync confirmation ledger. The schema records the
confirmed Stage 13A-13Z Lovable sync, merged main evidence, ledger sections,
ledger rules, required checks, product boundary, and post-merge Lovable
handoff as repository-owned sync confirmation evidence.

## Stage 14B-14F: Confirmation and lifecycle ledger

The previous Stage 13A-13Z confirmation must be recorded in repository files
before the Stage 14 handoff. Merged main evidence, Pull request lifecycle,
GitHub checks, and command outcomes are ledger requirements, not optional
notes.

## Stage 14G-14P: Diagnostics and hygiene ledger

Sync mismatch diagnostics, branch visibility checks, artifact hygiene,
project-memory confirmation, working contract enforcement, batch template
enforcement, previous-batch regression, preflight-all alignment, typecheck,
lockfile alignment, and package-lock immutability must all be represented in
the ledger.

## Stage 14Q-14Y: Prompt, boundary and handoff ledger

Prompt release gating, Lovable response gating, self-hosted boundary, privacy,
duplicate CI handling, long gate handling, risk rollback, next batch readiness,
and handoff packet generation are required before the prompt can be sent.

## Stage 14Z: Stage 15 hypothesis

The next normal batch after Stage 14A-14Z is Stage 15A-15Z unless repository
files define a different scope.

## Stage 7J: Product gap register

After the process contract is in place, the repository needs a product gap
register before returning to implementation work. This product gap register
must identify:

- confirmed product areas with repository evidence;
- remaining product gaps;
- the planned next batch for each gap;
- whether the gap affects backend, frontend, operations, or external adapter
  delivery;
- the self-hosted product boundary for the gap.

## Stage 7K: Next product batch planner

The next product work must be grouped into larger related batches before code
implementation starts. This next product batch planner must ensure each planned
batch:

- include at least three related stages;
- state its focus;
- state why it belongs in one Pull request;
- state product-boundary constraints;
- keep managed runtime and managed database dependencies out of the product
  runtime.

## Stage 7L: Product roadmap drift guard

The product roadmap drift guard compares:

- product roadmap manifest;
- roadmap reporter exports;
- docs;
- workflow;
- package scripts;
- `preflight-all` label;
- project-memory confirmed stage and next hypothesis.

The guard should fail when roadmap artifacts no longer describe the same next
product plan.

## Product boundary

Stage 7A-7L does not alter runtime behavior. It does not add backend routes,
database migrations, frontend pages, device integrations, or third-party
managed service dependencies.
