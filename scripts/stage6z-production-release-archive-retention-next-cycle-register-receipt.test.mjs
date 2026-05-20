import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionNextCycleRegisterReceipt,
  detectReleaseArchiveRetentionNextCycleRegisterReceiptLeaks,
  parseStage6ZArgs,
  readReleaseArchiveRetentionNextCycleRegisterReceiptManifest,
  renderProductionReleaseArchiveRetentionNextCycleRegisterReceiptMarkdown,
  runStage6ZProductionReleaseArchiveRetentionNextCycleRegisterReceipt,
  Stage6ZReleaseArchiveRetentionNextCycleRegisterReceiptError,
  validateReleaseArchiveRetentionNextCycleRegisterReceiptManifest,
} from "./stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs");

test("Stage 6Z validates the bundled release archive retention next-cycle register receipt manifest", () => {
  const manifest = validateReleaseArchiveRetentionNextCycleRegisterReceiptManifest(readReleaseArchiveRetentionNextCycleRegisterReceiptManifest());
  assert.equal(manifest.stage, "6Z");
  assert.equal(
    manifest.releaseArchiveRetentionNextCycleRegisterManifest,
    "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionNextCycleRegisterReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionNextCycleRegisterReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionNextCycleRegisterReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6y_release_archive_retention_next_cycle_register"));
  assert.equal(manifest.receiptPolicy.nextStageHypothesis, "Stage 7A");
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6Z builds a ready receipt from ready Stage 6Y retention next-cycle register", () => {
  const report = buildProductionReleaseArchiveRetentionNextCycleRegisterReceipt({
    manifest: readReleaseArchiveRetentionNextCycleRegisterReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionNextCycleRegisterReceipt, true);
  assert.equal(report.releaseArchiveRetentionNextCycleRegister.status, "ready");
  assert.equal(report.releaseArchiveRetentionNextCycleRegister.readyForExternalReleaseArchiveRetentionNextCycleRegister, true);
  assert.equal(report.releaseArchiveRetentionNextCycleRegisterReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionNextCycleRegisterStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveRetentionRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionNextCycleRegisterReceiptStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionNextCycleOwnerReceiptStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionNextCycleDecisionReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionNextCycleOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionNextCycleRegisterReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6Z markdown summarizes retention receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionNextCycleRegisterReceipt({
    manifest: readReleaseArchiveRetentionNextCycleRegisterReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionNextCycleRegisterReceiptMarkdown(report);
  assert.match(markdown, /Stage 6Z production release archive retention next-cycle register receipt/);
  assert.match(markdown, /Ready for external release archive retention next-cycle register receipt: `true`/);
  assert.match(markdown, /Stage 6Y archive retention next-cycle register status: `ready`/);
  assert.match(markdown, /External archive retention next-cycle register receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6Z rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveRetentionNextCycleRegisterReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "retention_next_cycle_review_receipt_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionNextCycleRegisterReceiptManifest(manifest),
    Stage6ZReleaseArchiveRetentionNextCycleRegisterReceiptError,
  );
});

test("Stage 6Z rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionNextCycleRegisterReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionNextCycleRegisterReceiptManifest(manifest), /failed validation/);
});

test("Stage 6Z leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionNextCycleRegisterReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveRetentionNextCycleRegisterReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionNextCycleRegisterReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionNextCycleRegisterReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6Z argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6ZArgs([
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
  assert.throws(() => parseStage6ZArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6Z CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6z-"));
  try {
    const summaryPath = join(dir, "retention-receipt.md");
    const jsonOut = join(dir, "retention-receipt.json");
    const result = runStage6ZProductionReleaseArchiveRetentionNextCycleRegisterReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6Z production release archive retention next-cycle register receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionNextCycleRegisterReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6Z CLI dry-run exits 0 and prints the receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6Z production release archive retention next-cycle register receipt/);
  assert.match(result.stdout, /Ready for external release archive retention next-cycle register receipt: `true`/);
});

test("Stage 6Z CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6z-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6Z production release archive retention next-cycle register receipt/);
    assert.match(result.stdout, /Stage 6Y archive retention next-cycle register status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
