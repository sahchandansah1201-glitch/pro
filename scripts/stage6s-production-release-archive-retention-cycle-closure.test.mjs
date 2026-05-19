import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleClosure,
  detectReleaseArchiveRetentionCycleClosureLeaks,
  parseStage6SArgs,
  readReleaseArchiveRetentionCycleClosureManifest,
  renderProductionReleaseArchiveRetentionCycleClosureMarkdown,
  runStage6SProductionReleaseArchiveRetentionCycleClosure,
  Stage6SReleaseArchiveRetentionCycleClosureError,
  validateReleaseArchiveRetentionCycleClosureManifest,
} from "./stage6s-production-release-archive-retention-cycle-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6s-production-release-archive-retention-cycle-closure.mjs");

test("Stage 6S validates the bundled release archive retention cycle closure manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleClosureManifest(
    readReleaseArchiveRetentionCycleClosureManifest(),
  );
  assert.equal(manifest.stage, "6S");
  assert.equal(
    manifest.releaseArchiveRetentionCycleIndexReceiptManifest,
    "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleClosureBundledInRepository, true);
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleIndexReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleClosureRecordsStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleClosureOutcomeKnownToRepository, false);
  assert.ok(manifest.closureInputs.some((item) => item.key === "stage6r_release_archive_retention_cycle_index_receipt"));
  assert.ok(manifest.externalClosureFields.every((item) => item.storeOutsideGit === true && item.redacted === true));
});

test("Stage 6S builds a ready closure from ready Stage 6R retention cycle index receipt", () => {
  const report = buildProductionReleaseArchiveRetentionCycleClosure({
    manifest: readReleaseArchiveRetentionCycleClosureManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleClosure, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexReceipt.generatedAt, "2026-05-19T13:30:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleIndexReceipt.status, "ready");
  assert.equal(report.releaseArchiveRetentionCycleIndexReceipt.readyForExternalReleaseArchiveRetentionCycleIndexReceipt, true);
  assert.deepEqual(report.releaseArchiveRetentionCycleIndexReceipt.missingInputs, []);
  assert.deepEqual(report.releaseArchiveRetentionCycleIndexReceipt.leakFindings, []);
  assert.equal(report.releaseArchiveRetentionCycleClosureStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleIndexStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionRegisterStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionCycleClosureRecordsStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionRegisterReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleIndexReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleClosureOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.closureInputs.every((item) => item.present));
});

test("Stage 6S keeps Stage 6R readiness tied to the Stage 6R manifest timestamp", () => {
  const report = buildProductionReleaseArchiveRetentionCycleClosure({
    manifest: readReleaseArchiveRetentionCycleClosureManifest(),
    root: ROOT,
    generatedAt: "2036-01-01T00:00:00.000Z",
  });
  assert.equal(report.generatedAt, "2036-01-01T00:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleIndexReceipt.generatedAt, "2026-05-19T13:30:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleIndexReceipt.status, "ready");
  assert.equal(report.status, "ready");
});

test("Stage 6S markdown summarizes retention cycle closure and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleClosure({
    manifest: readReleaseArchiveRetentionCycleClosureManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleClosureMarkdown(report);
  assert.match(markdown, /Stage 6S production release archive retention cycle closure/);
  assert.match(markdown, /Ready for external release archive retention cycle closure: `true`/);
  assert.match(markdown, /Stage 6R retention cycle index receipt generated at: `2026-05-19T13:30:00.000Z`/);
  assert.match(markdown, /Stage 6R retention cycle index receipt status: `ready`/);
  assert.match(markdown, /Stage 6R missing required inputs: `0`/);
  assert.match(markdown, /Stage 6R leak findings: `0`/);
  assert.match(markdown, /External archive retention cycle closure records stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6S rejects incomplete closure sections", () => {
  const manifest = readReleaseArchiveRetentionCycleClosureManifest();
  manifest.closureSections = manifest.closureSections.filter(
    (section) => section.key !== "retention_review_window_closure_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionCycleClosureManifest(manifest),
    Stage6SReleaseArchiveRetentionCycleClosureError,
  );
});

test("Stage 6S rejects external closure fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleClosureManifest();
  manifest.externalClosureFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleClosureManifest(manifest), /failed validation/);
});

test("Stage 6S leak scanner blocks unsafe closure content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureLeaks("safe redacted cycle closure"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleClosureLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6S argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6SArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T14:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T14:00:00.000Z",
  });
  assert.throws(() => parseStage6SArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6S CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6s-"));
  try {
    const summaryPath = join(dir, "retention-cycle-closure.md");
    const jsonOut = join(dir, "retention-cycle-closure.json");
    const result = runStage6SProductionReleaseArchiveRetentionCycleClosure({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T14:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6S production release archive retention cycle closure/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleClosureRecordsStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6S CLI dry-run exits 0 and prints the closure", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6S production release archive retention cycle closure/);
  assert.match(result.stdout, /Ready for external release archive retention cycle closure: `true`/);
});

test("Stage 6S CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6s-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6S production release archive retention cycle closure/);
    assert.match(result.stdout, /Stage 6R retention cycle index receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
