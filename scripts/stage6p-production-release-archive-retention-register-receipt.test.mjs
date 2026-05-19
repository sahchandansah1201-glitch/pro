import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionRegisterReceipt,
  detectReleaseArchiveRetentionRegisterReceiptLeaks,
  parseStage6PArgs,
  readReleaseArchiveRetentionRegisterReceiptManifest,
  renderProductionReleaseArchiveRetentionRegisterReceiptMarkdown,
  runStage6PProductionReleaseArchiveRetentionRegisterReceipt,
  Stage6PReleaseArchiveRetentionRegisterReceiptError,
  validateReleaseArchiveRetentionRegisterReceiptManifest,
} from "./stage6p-production-release-archive-retention-register-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6p-production-release-archive-retention-register-receipt.mjs");

test("Stage 6P validates the bundled release archive retention register receipt manifest", () => {
  const manifest = validateReleaseArchiveRetentionRegisterReceiptManifest(readReleaseArchiveRetentionRegisterReceiptManifest());
  assert.equal(manifest.stage, "6P");
  assert.equal(
    manifest.releaseArchiveRetentionRegisterManifest,
    "deploy/self-hosted/release-archive-retention-register.stage6o.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionRegisterReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionRegisterReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionRegisterReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6o_release_archive_retention_register"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6P builds a ready receipt from ready Stage 6O retention register", () => {
  const report = buildProductionReleaseArchiveRetentionRegisterReceipt({
    manifest: readReleaseArchiveRetentionRegisterReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionRegisterReceipt, true);
  assert.equal(report.releaseArchiveRetentionRegister.status, "ready");
  assert.equal(report.releaseArchiveRetentionRegister.readyForExternalReleaseArchiveRetentionRegister, true);
  assert.equal(report.releaseArchiveRetentionRegisterReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveRetentionRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionRegisterReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionRegisterReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6P markdown summarizes retention receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionRegisterReceipt({
    manifest: readReleaseArchiveRetentionRegisterReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionRegisterReceiptMarkdown(report);
  assert.match(markdown, /Stage 6P production release archive retention register receipt/);
  assert.match(markdown, /Ready for external release archive retention register receipt: `true`/);
  assert.match(markdown, /Stage 6O archive retention register status: `ready`/);
  assert.match(markdown, /External archive retention register receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6P rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveRetentionRegisterReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "retention_review_receipt_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionRegisterReceiptManifest(manifest),
    Stage6PReleaseArchiveRetentionRegisterReceiptError,
  );
});

test("Stage 6P rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionRegisterReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionRegisterReceiptManifest(manifest), /failed validation/);
});

test("Stage 6P leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionRegisterReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveRetentionRegisterReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionRegisterReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionRegisterReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6P argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6PArgs([
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
  assert.throws(() => parseStage6PArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6P CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6p-"));
  try {
    const summaryPath = join(dir, "retention-receipt.md");
    const jsonOut = join(dir, "retention-receipt.json");
    const result = runStage6PProductionReleaseArchiveRetentionRegisterReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6P production release archive retention register receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionRegisterReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6P CLI dry-run exits 0 and prints the receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6P production release archive retention register receipt/);
  assert.match(result.stdout, /Ready for external release archive retention register receipt: `true`/);
});

test("Stage 6P CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6p-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6P production release archive retention register receipt/);
    assert.match(result.stdout, /Stage 6O archive retention register status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
