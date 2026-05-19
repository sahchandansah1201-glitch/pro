import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveReconciliationReceipt,
  detectReleaseArchiveReconciliationReceiptLeaks,
  parseStage6LArgs,
  readReleaseArchiveReconciliationReceiptManifest,
  renderProductionReleaseArchiveReconciliationReceiptMarkdown,
  runStage6LProductionReleaseArchiveReconciliationReceipt,
  Stage6LReleaseArchiveReconciliationReceiptError,
  validateReleaseArchiveReconciliationReceiptManifest,
} from "./stage6l-production-release-archive-reconciliation-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6l-production-release-archive-reconciliation-receipt.mjs");

test("Stage 6L validates the bundled release archive reconciliation receipt manifest", () => {
  const manifest = validateReleaseArchiveReconciliationReceiptManifest(readReleaseArchiveReconciliationReceiptManifest());
  assert.equal(manifest.stage, "6L");
  assert.equal(manifest.releaseArchiveReconciliationManifest, "deploy/self-hosted/release-archive-reconciliation.stage6k.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveReconciliationReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveReconciliationReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveReconciliationReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6k_release_archive_reconciliation"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6L builds a ready receipt from ready Stage 6K reconciliation", () => {
  const report = buildProductionReleaseArchiveReconciliationReceipt({
    manifest: readReleaseArchiveReconciliationReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveReconciliationReceipt, true);
  assert.equal(report.releaseArchiveReconciliation.status, "ready");
  assert.equal(report.releaseArchiveReconciliation.readyForExternalReleaseArchiveReconciliation, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.externalArchiveReconciliationReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6L markdown summarizes receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveReconciliationReceipt({
    manifest: readReleaseArchiveReconciliationReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveReconciliationReceiptMarkdown(report);
  assert.match(markdown, /Stage 6L production release archive reconciliation receipt/);
  assert.match(markdown, /Ready for external release archive reconciliation receipt: `true`/);
  assert.match(markdown, /Stage 6K archive reconciliation status: `ready`/);
  assert.match(markdown, /External archive reconciliation receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6L rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveReconciliationReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "final_reconciliation_outcome_reference",
  );
  assert.throws(() => validateReleaseArchiveReconciliationReceiptManifest(manifest), Stage6LReleaseArchiveReconciliationReceiptError);
});

test("Stage 6L rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveReconciliationReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveReconciliationReceiptManifest(manifest), /failed validation/);
});

test("Stage 6L leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveReconciliationReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveReconciliationReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveReconciliationReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveReconciliationReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6L argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6LArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T11:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T11:00:00.000Z",
  });
  assert.throws(() => parseStage6LArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6L CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6l-"));
  try {
    const summaryPath = join(dir, "receipt.md");
    const jsonOut = join(dir, "receipt.json");
    const result = runStage6LProductionReleaseArchiveReconciliationReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6L production release archive reconciliation receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveReconciliationReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6L CLI dry-run exits 0 and prints the receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6L production release archive reconciliation receipt/);
  assert.match(result.stdout, /Ready for external release archive reconciliation receipt: `true`/);
});

test("Stage 6L CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6l-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6L production release archive reconciliation receipt/);
    assert.match(result.stdout, /Stage 6K archive reconciliation status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
