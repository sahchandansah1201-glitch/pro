import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectStage6YChecks } from "./check-stage6y-production-release-archive-retention-next-cycle-register.mjs";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json",
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs",
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.test.mjs",
  "scripts/check-stage6y-production-release-archive-retention-next-cycle-register.mjs",
  "scripts/check-stage6y-production-release-archive-retention-next-cycle-register.test.mjs",
  "docs/backend/stage-6y-production-release-archive-retention-next-cycle-register.md",
  ".github/workflows/stage6y-production-release-archive-retention-next-cycle-register.yml",
];

test("Stage 6Y guard passes for the repository tree", () => {
  const result = collectStage6YChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles.length, REQUIRED_FILES.length);
});

test("Stage 6Y guard reports missing required files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6y-check-missing-"));
  try {
    const result = collectStage6YChecks(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required Stage 6Y file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6Y guard blocks forbidden managed runtime coupling", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6y-check-forbidden-"));
  try {
    for (const file of REQUIRED_FILES) {
      mkdirSync(join(dir, file, ".."), { recursive: true });
      writeFileSync(join(dir, file), "Stage 6Y\n");
    }
    mkdirSync(join(dir, "scripts"), { recursive: true });
    mkdirSync(join(dir, "deploy/self-hosted"), { recursive: true });
    writeFileSync(
      join(dir, "scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs"),
      "Stage 6Y\nbuildProductionReleaseArchiveRetentionNextCycleRegister\nrenderProductionReleaseArchiveRetentionNextCycleRegisterMarkdown\nrunStage6YProductionReleaseArchiveRetentionNextCycleRegister\nbuildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt\narchiveRetentionNextCycleOutcomeKnownToRepository\nSUPABASE_URL\n",
    );
    writeFileSync(join(dir, "package.json"), "{\"scripts\":{\"test:stage6y\":\"\",\"check:stage6y\":\"\",\"preflight:stage6y\":\"\",\"register:stage6y:dry-run\":\"\",\"register:stage6y:report\":\"\"}}");
    writeFileSync(join(dir, "scripts/preflight-all.mjs"), "Stage 6Y production release archive retention next-cycle register preflight");
    const result = collectStage6YChecks(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 6Y runtime/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
