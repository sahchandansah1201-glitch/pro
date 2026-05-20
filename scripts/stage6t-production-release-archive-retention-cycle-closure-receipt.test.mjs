import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleClosureReceipt,
  detectReleaseArchiveRetentionCycleClosureReceiptLeaks,
  parseStage6TArgs,
  readReleaseArchiveRetentionCycleClosureReceiptManifest,
  renderProductionReleaseArchiveRetentionCycleClosureReceiptMarkdown,
  runStage6TProductionReleaseArchiveRetentionCycleClosureReceipt,
  Stage6TReleaseArchiveRetentionCycleClosureReceiptError,
  validateReleaseArchiveRetentionCycleClosureReceiptManifest,
} from "./stage6t-production-release-archive-retention-cycle-closure-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6t-production-release-archive-retention-cycle-closure-receipt.mjs");

test("Stage 6T validates the bundled release archive retention cycle closure receipt manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleClosureReceiptManifest(
    readReleaseArchiveRetentionCycleClosureReceiptManifest(),
  );
  assert.equal(manifest.stage, "6T");
  assert.equal(
    manifest.releaseArchiveRetentionCycleClosureManifest,
    "deploy/self-hosted/release-archive-retention-cycle-closure.stage6s.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleClosureReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleClosureBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleClosureReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleClosureReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6s_release_archive_retention_cycle_closure"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true && item.redacted === true));
});

test("Stage 6T builds a ready receipt from ready Stage 6S retention cycle closure", () => {
  const report = buildProductionReleaseArchiveRetentionCycleClosureReceipt({
    manifest: readReleaseArchiveRetentionCycleClosureReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleClosureReceipt, true);
  assert.equal(report.releaseArchiveRetentionCycleClosure.generatedAt, "2026-05-19T14:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleClosure.status, "ready");
  assert.equal(report.releaseArchiveRetentionCycleClosure.readyForExternalReleaseArchiveRetentionCycleClosure, true);
  assert.deepEqual(report.releaseArchiveRetentionCycleClosure.missingInputs, []);
  assert.deepEqual(report.releaseArchiveRetentionCycleClosure.leakFindings, []);
  assert.equal(report.releaseArchiveRetentionCycleClosureReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleClosureStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleClosureRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionCycleClosureReceiptStoredOutsideGit, true);
  assert.equal(report.archiveRetentionCycleClosureOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleClosureReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6T keeps Stage 6S readiness tied to the Stage 6S manifest timestamp", () => {
  const report = buildProductionReleaseArchiveRetentionCycleClosureReceipt({
    manifest: readReleaseArchiveRetentionCycleClosureReceiptManifest(),
    root: ROOT,
    generatedAt: "2036-01-01T00:00:00.000Z",
  });
  assert.equal(report.generatedAt, "2036-01-01T00:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleClosure.generatedAt, "2026-05-19T14:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleClosure.status, "ready");
  assert.equal(report.status, "ready");
});

test("Stage 6T markdown summarizes retention cycle closure receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleClosureReceipt({
    manifest: readReleaseArchiveRetentionCycleClosureReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleClosureReceiptMarkdown(report);
  assert.match(markdown, /Stage 6T production release archive retention cycle closure receipt/);
  assert.match(markdown, /Ready for external release archive retention cycle closure receipt: `true`/);
  assert.match(markdown, /Stage 6S retention cycle closure generated at: `2026-05-19T14:00:00.000Z`/);
  assert.match(markdown, /Stage 6S retention cycle closure status: `ready`/);
  assert.match(markdown, /Stage 6S missing required inputs: `0`/);
  assert.match(markdown, /Stage 6S leak findings: `0`/);
  assert.match(markdown, /External archive retention cycle closure receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6T rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveRetentionCycleClosureReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "retention_review_window_closure_receipt_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionCycleClosureReceiptManifest(manifest),
    Stage6TReleaseArchiveRetentionCycleClosureReceiptError,
  );
});

test("Stage 6T rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleClosureReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleClosureReceiptManifest(manifest), /failed validation/);
});

test("Stage 6T leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureReceiptLeaks("safe redacted cycle closure receipt"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6T argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6TArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T14:30:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T14:30:00.000Z",
  });
  assert.throws(() => parseStage6TArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6T CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6t-"));
  try {
    const summaryPath = join(dir, "retention-cycle-closure-receipt.md");
    const jsonOut = join(dir, "retention-cycle-closure-receipt.json");
    const result = runStage6TProductionReleaseArchiveRetentionCycleClosureReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T14:30:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6T production release archive retention cycle closure receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleClosureReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6T CLI dry-run exits 0 and prints the receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6T production release archive retention cycle closure receipt/);
  assert.match(result.stdout, /Ready for external release archive retention cycle closure receipt: `true`/);
});

test("Stage 6T CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6t-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6T production release archive retention cycle closure receipt/);
    assert.match(result.stdout, /Stage 6S retention cycle closure status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
