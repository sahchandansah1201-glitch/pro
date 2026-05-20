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
