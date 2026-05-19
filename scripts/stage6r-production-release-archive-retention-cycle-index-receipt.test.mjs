import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleIndexReceipt,
  detectReleaseArchiveRetentionCycleIndexReceiptLeaks,
  parseStage6RArgs,
  readReleaseArchiveRetentionCycleIndexReceiptManifest,
  renderProductionReleaseArchiveRetentionCycleIndexReceiptMarkdown,
  runStage6RProductionReleaseArchiveRetentionCycleIndexReceipt,
  Stage6RReleaseArchiveRetentionCycleIndexReceiptError,
  validateReleaseArchiveRetentionCycleIndexReceiptManifest,
} from "./stage6r-production-release-archive-retention-cycle-index-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6r-production-release-archive-retention-cycle-index-receipt.mjs");

test("Stage 6R validates the bundled release archive retention cycle index receipt manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleIndexReceiptManifest(
    readReleaseArchiveRetentionCycleIndexReceiptManifest(),
  );
  assert.equal(manifest.stage, "6R");
  assert.equal(
    manifest.releaseArchiveRetentionCycleIndexManifest,
    "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleIndexReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleIndexReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleIndexReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6q_release_archive_retention_cycle_index"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true && item.redacted === true));
});

test("Stage 6R builds a ready receipt from ready Stage 6Q retention cycle index", () => {
  const report = buildProductionReleaseArchiveRetentionCycleIndexReceipt({
    manifest: readReleaseArchiveRetentionCycleIndexReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleIndexReceipt, true);
  assert.equal(report.releaseArchiveRetentionCycleIndex.generatedAt, "2026-05-19T13:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleIndex.status, "ready");
  assert.equal(report.releaseArchiveRetentionCycleIndex.readyForExternalReleaseArchiveRetentionCycleIndex, true);
  assert.deepEqual(report.releaseArchiveRetentionCycleIndex.missingInputs, []);
  assert.deepEqual(report.releaseArchiveRetentionCycleIndex.leakFindings, []);
  assert.equal(report.releaseArchiveRetentionCycleIndexReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionCycleIndexReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionRegisterReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleIndexReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6R keeps Stage 6Q readiness tied to the Stage 6Q manifest timestamp", () => {
  const report = buildProductionReleaseArchiveRetentionCycleIndexReceipt({
    manifest: readReleaseArchiveRetentionCycleIndexReceiptManifest(),
    root: ROOT,
    generatedAt: "2036-01-01T00:00:00.000Z",
  });
  assert.equal(report.generatedAt, "2036-01-01T00:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleIndex.generatedAt, "2026-05-19T13:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleIndex.status, "ready");
  assert.equal(report.status, "ready");
});

test("Stage 6R markdown summarizes retention cycle index receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleIndexReceipt({
    manifest: readReleaseArchiveRetentionCycleIndexReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleIndexReceiptMarkdown(report);
  assert.match(markdown, /Stage 6R production release archive retention cycle index receipt/);
  assert.match(markdown, /Ready for external release archive retention cycle index receipt: `true`/);
  assert.match(markdown, /Stage 6Q retention cycle index generated at: `2026-05-19T13:00:00.000Z`/);
  assert.match(markdown, /Stage 6Q retention cycle index status: `ready`/);
  assert.match(markdown, /Stage 6Q missing required inputs: `0`/);
  assert.match(markdown, /Stage 6Q leak findings: `0`/);
  assert.match(markdown, /External archive retention cycle index receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6R rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveRetentionCycleIndexReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "retention_review_window_receipt_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionCycleIndexReceiptManifest(manifest),
    Stage6RReleaseArchiveRetentionCycleIndexReceiptError,
  );
});

test("Stage 6R rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleIndexReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleIndexReceiptManifest(manifest), /failed validation/);
});

test("Stage 6R leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexReceiptLeaks("safe redacted cycle receipt"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleIndexReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6R argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6RArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T13:30:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T13:30:00.000Z",
  });
  assert.throws(() => parseStage6RArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6R CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6r-"));
  try {
    const summaryPath = join(dir, "retention-cycle-index-receipt.md");
    const jsonOut = join(dir, "retention-cycle-index-receipt.json");
    const result = runStage6RProductionReleaseArchiveRetentionCycleIndexReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T13:30:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6R production release archive retention cycle index receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleIndexReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6R CLI dry-run exits 0 and prints the receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6R production release archive retention cycle index receipt/);
  assert.match(result.stdout, /Ready for external release archive retention cycle index receipt: `true`/);
});

test("Stage 6R CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6r-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6R production release archive retention cycle index receipt/);
    assert.match(result.stdout, /Stage 6Q retention cycle index status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
