import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleFinalClosure,
  detectReleaseArchiveRetentionCycleFinalClosureLeaks,
  parseStage6UArgs,
  readReleaseArchiveRetentionCycleFinalClosureManifest,
  renderProductionReleaseArchiveRetentionCycleFinalClosureMarkdown,
  runStage6UProductionReleaseArchiveRetentionCycleFinalClosure,
  Stage6UReleaseArchiveRetentionCycleFinalClosureError,
  validateReleaseArchiveRetentionCycleFinalClosureManifest,
} from "./stage6u-production-release-archive-retention-cycle-final-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6u-production-release-archive-retention-cycle-final-closure.mjs");

test("Stage 6U validates the bundled release archive retention cycle final closure manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleFinalClosureManifest(
    readReleaseArchiveRetentionCycleFinalClosureManifest(),
  );
  assert.equal(manifest.stage, "6U");
  assert.equal(
    manifest.releaseArchiveRetentionCycleClosureReceiptManifest,
    "deploy/self-hosted/release-archive-retention-cycle-closure-receipt.stage6t.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleFinalClosureBundledInRepository, true);
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleClosureReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleFinalClosureOutcomeKnownToRepository, false);
  assert.ok(manifest.closureInputs.some((item) => item.key === "stage6t_release_archive_retention_cycle_closure_receipt"));
  assert.ok(manifest.externalClosureFields.every((item) => item.storeOutsideGit === true && item.redacted === true));
});

test("Stage 6U builds a ready final closure from ready Stage 6T retention cycle closure receipt", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosure({
    manifest: readReleaseArchiveRetentionCycleFinalClosureManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleFinalClosure, true);
  assert.equal(report.releaseArchiveRetentionCycleClosureReceipt.generatedAt, "2026-05-19T14:30:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleClosureReceipt.status, "ready");
  assert.equal(
    report.releaseArchiveRetentionCycleClosureReceipt.readyForExternalReleaseArchiveRetentionCycleClosureReceipt,
    true,
  );
  assert.deepEqual(report.releaseArchiveRetentionCycleClosureReceipt.missingInputs, []);
  assert.deepEqual(report.releaseArchiveRetentionCycleClosureReceipt.leakFindings, []);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleClosureReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleClosureStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit, true);
  assert.equal(report.archiveRetentionCycleClosureReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleFinalClosureOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.closureInputs.every((item) => item.present));
});

test("Stage 6U keeps Stage 6T readiness tied to the Stage 6T manifest timestamp", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosure({
    manifest: readReleaseArchiveRetentionCycleFinalClosureManifest(),
    root: ROOT,
    generatedAt: "2036-01-01T00:00:00.000Z",
  });
  assert.equal(report.generatedAt, "2036-01-01T00:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleClosureReceipt.generatedAt, "2026-05-19T14:30:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleClosureReceipt.status, "ready");
  assert.equal(report.status, "ready");
});

test("Stage 6U markdown summarizes retention cycle final closure and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosure({
    manifest: readReleaseArchiveRetentionCycleFinalClosureManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleFinalClosureMarkdown(report);
  assert.match(markdown, /Stage 6U production release archive retention cycle final closure/);
  assert.match(markdown, /Ready for external release archive retention cycle final closure: `true`/);
  assert.match(markdown, /Stage 6T retention cycle closure receipt generated at: `2026-05-19T14:30:00.000Z`/);
  assert.match(markdown, /Stage 6T retention cycle closure receipt status: `ready`/);
  assert.match(markdown, /Stage 6T missing required inputs: `0`/);
  assert.match(markdown, /Stage 6T leak findings: `0`/);
  assert.match(markdown, /External archive retention cycle final closure records stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6U rejects incomplete final closure sections", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureManifest();
  manifest.closureSections = manifest.closureSections.filter(
    (section) => section.key !== "retention_review_window_final_closure_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionCycleFinalClosureManifest(manifest),
    Stage6UReleaseArchiveRetentionCycleFinalClosureError,
  );
});

test("Stage 6U rejects external final closure fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureManifest();
  manifest.externalClosureFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleFinalClosureManifest(manifest), /failed validation/);
});

test("Stage 6U leak scanner blocks unsafe final closure content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureLeaks("safe redacted cycle final closure"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6U argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6UArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T15:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T15:00:00.000Z",
  });
  assert.throws(() => parseStage6UArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6U CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6u-"));
  try {
    const summaryPath = join(dir, "retention-cycle-final-closure.md");
    const jsonOut = join(dir, "retention-cycle-final-closure.json");
    const result = runStage6UProductionReleaseArchiveRetentionCycleFinalClosure({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T15:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6U production release archive retention cycle final closure/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6U CLI dry-run exits 0 and prints the final closure", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6U production release archive retention cycle final closure/);
  assert.match(result.stdout, /Ready for external release archive retention cycle final closure: `true`/);
});

test("Stage 6U CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6u-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6U production release archive retention cycle final closure/);
    assert.match(result.stdout, /Stage 6T retention cycle closure receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
