# Stage 10A-10Z · Error prevention and x2 batch quality gates

Stage 10A-10Z is a process and quality-control batch. It does not change
runtime product behavior. Its purpose is to convert repeated development
mistakes into repository-owned diagnostics before a Pull request is merged and
before a Lovable sync prompt is sent.

## Scope

- Stage 10A: Error taxonomy register.
- Stage 10B: Pre-implementation repository state gate.
- Stage 10C: Batch size compliance gate.
- Stage 10D: Manifest-to-docs alignment gate.
- Stage 10E: Package script alignment gate.
- Stage 10F: Preflight-all alignment gate.
- Stage 10G: Project-memory post-merge wording gate.
- Stage 10H: Lovable prompt timing gate.
- Stage 10I: Temporary artifact detection gate.
- Stage 10J: Lockfile integrity gate.
- Stage 10K: Boundary marker guard.
- Stage 10L: Typecheck before PR gate.
- Stage 10M: Stage-specific preflight gate.
- Stage 10N: Previous-batch regression gate.
- Stage 10O: UI fetch-count drift gate.
- Stage 10P: Shared UI type drift gate.
- Stage 10Q: Dry-run output hygiene gate.
- Stage 10R: GitHub check wait gate.
- Stage 10S: Post-merge local main verification gate.
- Stage 10T: Lovable sync mismatch diagnostic gate.
- Stage 10U: Failure-to-prevention worklog gate.
- Stage 10V: Mandatory command bundle.
- Stage 10W: Pull request evidence bundle.
- Stage 10X: CI workflow gate.
- Stage 10Y: Project-memory refresh.
- Stage 10Z: Next x2 batch handoff.

## x2 batch

The previous confirmed batch, Stage 9N-9Z, contained 13 related stages.
Stage 10A-10Z contains 26 related stages and records that scaling directly in
`deploy/self-hosted/error-prevention.stage10a-10z.json`.

This is the default target shape for the next normal batch. Smaller Pull
requests are only allowed for documented hotfix, security fix, urgent CI fix,
or single-file typo work.

## Diagnosed defects

Stage 10A-10Z records concrete defects found during Stage 9N-9Z:

- UI fetch-count drift when a new endpoint was added to `SysDevicesPage`.
- Shared UI type drift when a metric value changed from numeric-only to
  number-or-string.
- `preflight-all` drift after adding a new stage preflight.
- Temporary dry-run output (`var/`) appearing in the working tree.
- Project-memory wording lagging behind the intended post-merge state.
- GitHub GraphQL status calls timing out during PR check polling.
- Guard self-scan false positives when a protected scan includes helper files
  that intentionally define forbidden marker patterns.
- Historical marker drift when an expanded x2 batch removes a previous
  hypothesis marker still required by older guards.

Each defect has a paired prevention rule in the manifest. The rule is not
"be careful"; it is a concrete command, guard, or workflow behavior.

## Prevention gates

Required commands:

```bash
npm run test:stage10a-10z
npm run check:stage10a-10z
npm run prevention:stage10a-10z:dry-run
npm run preflight:stage10a-10z
npm run preflight:stage9n-9z
npm run check:project-memory
npm run typecheck
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git diff --check
```

`npm run preflight:stage10a-10z` is intentionally focused. It proves the
error-prevention layer is internally consistent, checks the previous batch, and
keeps the project-memory and lockfile guards active.

## Lovable gate

The Lovable prompt is only valid after:

1. the Pull request is merged into `main`;
2. local `main` contains the merged commit;
3. `npm run preflight:stage10a-10z` passes on local `main`;
4. `npm run check:project-memory` passes on local `main`;
5. `node scripts/check-no-deno-locks.mjs` passes.

Open Pull request branches are not valid Lovable sync targets unless branch
switching is explicitly enabled in Lovable.

## Product boundary

- Managed runtime/database dependency: none.
- Runtime behavior changed: false.
- Database migrations: none.
- Backend routes: none.
- Frontend product UI: none.
- Browser hardware APIs: false.
- External runtime calls: false.
- Data visibility: repository metadata only.

The batch must not print or store secrets, patient identifiers, tokens, signed
URLs, worker payloads, result payloads, or storage object paths.

## Outputs

- Manifest: `deploy/self-hosted/error-prevention.stage10a-10z.json`
- Renderer: `scripts/stage10a-10z-error-prevention.mjs`
- Guard: `scripts/check-stage10a-10z-error-prevention.mjs`
- Workflow: `.github/workflows/stage10a-10z-error-prevention.yml`

## Next hypothesis

Stage 11A-11Z is the next x2 batch hypothesis. Its product scope is not
confirmed until repository files define it.
