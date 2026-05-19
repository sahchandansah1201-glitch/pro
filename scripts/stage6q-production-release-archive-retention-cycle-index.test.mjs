import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleIndex,
  detectReleaseArchiveRetentionCycleIndexLeaks,
  parseStage6QArgs,
  readReleaseArchiveRetentionCycleIndexManifest,
  renderProductionReleaseArchiveRetentionCycleIndexMarkdown,
  runStage6QProductionReleaseArchiveRetentionCycleIndex,
  Stage6QReleaseArchiveRetentionCycleIndexError,
  validateReleaseArchiveRetentionCycleIndexManifest,
} from "./stage6q-production-release-archive-retention-cycle-index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6q-production-release-archive-retention-cycle-index.mjs");

test("Stage 6Q validates the bundled release archive retention cycle index manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleIndexManifest(readReleaseArchiveRetentionCycleIndexManifest());
  assert.equal(manifest.stage, "6Q");
  assert.equal(
    manifest.releaseArchiveRetentionRegisterReceiptManifest,
    "deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleIndexBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleRecordsStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleOutcomeKnownToRepository, false);
  assert.ok(manifest.cycleInputs.some((item) => item.key === "stage6p_release_archive_retention_register_receipt"));
  assert.ok(manifest.externalCycleFields.every((item) => item.storeOutsideGit === true && item.redacted === true));
});

test("Stage 6Q builds a ready cycle index from ready Stage 6P retention receipt", () => {
  const report = buildProductionReleaseArchiveRetentionCycleIndex({
    manifest: readReleaseArchiveRetentionCycleIndexManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleIndex, true);
  assert.equal(report.releaseArchiveRetentionRegisterReceipt.status, "ready");
  assert.equal(report.releaseArchiveRetentionRegisterReceipt.readyForExternalReleaseArchiveRetentionRegisterReceipt, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleRecordsStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionRegisterReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.cycleInputs.every((item) => item.present));
});

test("Stage 6Q markdown summarizes retention cycle index and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleIndex({
    manifest: readReleaseArchiveRetentionCycleIndexManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleIndexMarkdown(report);
  assert.match(markdown, /Stage 6Q production release archive retention cycle index/);
  assert.match(markdown, /Ready for external release archive retention cycle index: `true`/);
  assert.match(markdown, /Stage 6P retention register receipt status: `ready`/);
  assert.match(markdown, /External archive retention cycle records stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6Q rejects incomplete cycle sections", () => {
  const manifest = readReleaseArchiveRetentionCycleIndexManifest();
  manifest.cycleSections = manifest.cycleSections.filter(
    (section) => section.key !== "retention_review_cadence_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionCycleIndexManifest(manifest),
    Stage6QReleaseArchiveRetentionCycleIndexError,
  );
});

test("Stage 6Q rejects external cycle fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleIndexManifest();
  manifest.externalCycleFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleIndexManifest(manifest), /failed validation/);
});

test("Stage 6Q leak scanner blocks unsafe cycle content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexLeaks("safe redacted cycle index"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6Q argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6QArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T13:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T13:00:00.000Z",
  });
  assert.throws(() => parseStage6QArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6Q CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6q-"));
  try {
    const summaryPath = join(dir, "retention-cycle-index.md");
    const jsonOut = join(dir, "retention-cycle-index.json");
    const result = runStage6QProductionReleaseArchiveRetentionCycleIndex({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T13:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6Q production release archive retention cycle index/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleRecordsStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6Q CLI dry-run exits 0 and prints the cycle index", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6Q production release archive retention cycle index/);
  assert.match(result.stdout, /Ready for external release archive retention cycle index: `true`/);
});

test("Stage 6Q CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6q-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6Q production release archive retention cycle index/);
    assert.match(result.stdout, /Stage 6P retention register receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
