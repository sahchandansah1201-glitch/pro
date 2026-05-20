import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt,
  detectReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptLeaks,
  parseStage6XArgs,
  readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest,
  renderProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptMarkdown,
  runStage6XProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt,
  Stage6XReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptError,
  validateReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest,
} from "./stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.mjs");

test("Stage 6X validates the bundled release archive retention cycle final closure reconciliation receipt manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest());
  assert.equal(manifest.stage, "6X");
  assert.equal(manifest.releaseArchiveRetentionCycleFinalClosureReconciliationManifest, "deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation.stage6w.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleFinalClosureReconciliationReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleFinalClosureReconciliationBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleFinalClosureReconciliationReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleFinalClosureReconciliationReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6w_release_archive_retention_cycle_final_closure_reconciliation"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6X builds a ready receipt from ready Stage 6W reconciliation", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReconciliation.status, "ready");
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReconciliation.readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliation, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReconciliationStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionCycleFinalClosureReconciliationReceiptStoredOutsideGit, true);
  assert.equal(report.archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleFinalClosureReconciliationReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6X markdown summarizes receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptMarkdown(report);
  assert.match(markdown, /Stage 6X production release archive retention cycle final closure reconciliation receipt/);
  assert.match(markdown, /Ready for external release archive retention cycle final closure reconciliation receipt: `true`/);
  assert.match(markdown, /Stage 6W archive retention cycle final closure reconciliation status: `ready`/);
  assert.match(markdown, /External archive retention cycle final closure reconciliation receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6X rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "final_closure_receipt_reconciliation_reference",
  );
  assert.throws(() => validateReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(manifest), Stage6XReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptError);
});

test("Stage 6X rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(manifest), /failed validation/);
});

test("Stage 6X leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6X argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6XArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T17:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T17:00:00.000Z",
  });
  assert.throws(() => parseStage6XArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6X CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6x-"));
  try {
    const summaryPath = join(dir, "receipt.md");
    const jsonOut = join(dir, "receipt.json");
    const result = runStage6XProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6X production release archive retention cycle final closure reconciliation receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleFinalClosureReconciliationReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6X CLI dry-run exits 0 and prints the receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6X production release archive retention cycle final closure reconciliation receipt/);
  assert.match(result.stdout, /Ready for external release archive retention cycle final closure reconciliation receipt: `true`/);
});

test("Stage 6X CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6x-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6X production release archive retention cycle final closure reconciliation receipt/);
    assert.match(result.stdout, /Stage 6W archive retention cycle final closure reconciliation status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
