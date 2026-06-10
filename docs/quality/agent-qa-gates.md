# Agent-QA Gates

Date: 2026-06-05

Purpose: make the SkinDoctor Orchestrator 5x upgrade executable instead of advisory.

## Scripts

- `npm run qa:agent`
  - Runs static/local no-API gates that do not require a browser server:
    - `qa:architecture`;
    - `qa:security-patterns`;
    - `qa:simplicity`;
    - `qa:agent-evals`;
    - `qa:human-ui`;
    - `qa:osv`.

- `npm run qa:architecture`
  - Uses `dependency-cruiser`.
  - Blocks frontend importing backend internals, patient UI importing doctor pages, public UI importing privileged pages, and backend importing UI modules.
  - Circular dependencies are currently warnings to avoid breaking on legacy structure before a cleanup plan.

- `npm run qa:security-patterns`
  - Uses local Semgrep rules in `semgrep/skindoctor-quality.yml`.
  - Blocks protected-field leakage and unsupported medical claims in patient/public UI surfaces.

- `npm run qa:simplicity`
  - Uses a local no-dependency Node checker.
  - Enforces a baseline-ratchet policy for frontend/backend implementation size.
  - Existing oversized files are tracked as debt, not treated as a reason to fail today's pipeline.
  - The gate fails if a known oversized file grows beyond its baseline allowance or if a new oversized file appears.
  - Writes `reports/agent-qa/simplicity-ledger.json`.

- `npm run qa:agent-evals`
  - Uses Promptfoo standalone assertions with no provider configured and no API key.
  - Checks core orchestrator behavior contracts:
    - plan item present;
    - KB/project-memory discipline;
    - no fake Lovable sync confirmation;
    - no patient delivery;
    - no diagnosis/risk/prognosis/treatment claims;
    - SD-MF coverage markers present.

- `npm run qa:osv`
  - Uses `osv-scanner` against `package-lock.json`.
  - Requires no API key. It may query public OSV data unless run with offline flags.

- `npm run qa:osv:all`
  - Runs a full recursive source scan.
  - Current known state: this also scans tracked legacy `bun.lock`/`bun.lockb`; on 2026-06-05 it found vulnerabilities only from `bun.lock`, while `package-lock.json` was clean.
  - Treat this as the supply-chain cleanup backlog until the project either updates Bun lockfiles or removes them deliberately.

- `npm run qa:a11y`
  - Uses Playwright + axe.
  - Requires the app to be served at the Playwright `baseURL` (`http://localhost:8080` in `playwright.config.ts`).
  - Checks `/cockpit`, visit report workspace, lesion comparison, and admin governance for serious/critical automated a11y violations.

## Boundaries

- No secrets or provider API keys are required.
- No new npm package is required by `qa:simplicity`.
- No patient delivery is enabled by these gates.
- No clinical dynamic conclusion or diagnosis/risk/prognosis/treatment output is introduced.
- `qa:a11y` is intentionally separate from `qa:agent` because it requires a running browser target.

## Покрытие мозгового штурма

| SD-MF | Статус | Gate contribution | Remaining |
|---|---|---|---|
| `SD-MF-025` Хронология очага | в работе | Architecture, a11y, and report-marker gates make timeline QA work more verifiable. | Real production dataset validation and timeline rollout evidence. |
| `SD-MF-026` Режим сравнения снимков | в работе | A11y and architecture gates cover comparison surfaces and prevent UI/backend boundary drift. | Clinical-grade reviewer workflow validation on production assets. |
| `SD-MF-028` Достоверность анализа динамики | в работе | Agent/security gates block unsupported dynamic/diagnostic claims. | Approved clinical validation procedure and monitored post-rollout review. |
| `SD-MF-046` Пациентский протокол / история новообразований | в работе | Semgrep and agent evals reinforce patient-delivery and protected-field boundaries. | Patient delivery remains off until privacy/security/retention/session/approved-copy gates are closed. |
