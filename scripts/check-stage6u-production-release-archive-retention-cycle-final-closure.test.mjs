import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectStage6UChecks } from "./check-stage6u-production-release-archive-retention-cycle-final-closure.mjs";

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "stage6u-check-"));
  for (const dir of [
    "deploy/self-hosted",
    "scripts",
    "docs/backend",
    ".github/workflows",
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  const files = {
    "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json": "releaseArchiveRetentionCycleClosureReceiptManifest stage6t_release_archive_retention_cycle_closure_receipt closureInputs closureSections externalClosureFields closureGates closurePolicy externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit externalArchiveRetentionCycleClosureReceiptStoredOutsideGit archiveRetentionCycleFinalClosureOutcomeKnownToRepository archiveRetentionCycleClosureReceiptOutcomeKnownToRepository",
    "scripts/stage6u-production-release-archive-retention-cycle-final-closure.mjs": "Stage 6U buildProductionReleaseArchiveRetentionCycleFinalClosure renderProductionReleaseArchiveRetentionCycleFinalClosureMarkdown readyForExternalReleaseArchiveRetentionCycleFinalClosure no network calls does not store live",
    "scripts/stage6u-production-release-archive-retention-cycle-final-closure.test.mjs": "ready final closure CLI writes markdown and JSON outputs leak scanner blocks unsafe final closure content",
    "scripts/check-stage6u-production-release-archive-retention-cycle-final-closure.mjs": "check",
    "scripts/check-stage6u-production-release-archive-retention-cycle-final-closure.test.mjs": "check test",
    "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md": "Stage 6U npm run preflight:stage6u production release archive retention cycle final closure Stage 6T Managed runtime/database dependency: none",
    ".github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml": "name: stage6u-production-release-archive-retention-cycle-final-closure npm run preflight:stage6u stage6u-production-release-archive-retention-cycle-final-closure.md GITHUB_STEP_SUMMARY",
    "package.json": "{\"scripts\":{\"test:stage6u\":\"x\",\"check:stage6u\":\"x\",\"preflight:stage6u\":\"x\",\"closure:stage6u:dry-run\":\"x\",\"closure:stage6u:report\":\"x\"}}",
    "scripts/preflight-all.mjs": "Stage 6U production release archive retention cycle final closure preflight",
  };
  for (const [file, content] of Object.entries(files)) writeFileSync(join(root, file), `${content}\n`);
  return root;
}

test("Stage 6U guard passes for complete fixture", () => {
  const result = collectStage6UChecks({ root: createFixture() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6U guard rejects forbidden runtime coupling", () => {
  const root = createFixture();
  writeFileSync(
    join(root, "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md"),
    "Stage 6U npm run preflight:stage6u production release archive retention cycle final closure Stage 6T Managed runtime/database dependency: none SUPABASE_URL\n",
  );
  const result = collectStage6UChecks({ root });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("forbidden")));
});
