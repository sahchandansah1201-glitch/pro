import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveFinalClosure,
  detectReleaseArchiveFinalClosureLeaks,
  parseStage6MArgs,
  readReleaseArchiveFinalClosureManifest,
  renderProductionReleaseArchiveFinalClosureMarkdown,
  runStage6MProductionReleaseArchiveFinalClosure,
  Stage6MReleaseArchiveFinalClosureError,
  validateReleaseArchiveFinalClosureManifest,
} from "./stage6m-production-release-archive-final-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6m-production-release-archive-final-closure.mjs");

test("Stage 6M validates the bundled release archive final closure manifest", () => {
  const manifest = validateReleaseArchiveFinalClosureManifest(readReleaseArchiveFinalClosureManifest());
  assert.equal(manifest.stage, "6M");
  assert.equal(
    manifest.releaseArchiveReconciliationReceiptManifest,
    "deploy/self-hosted/release-archive-reconciliation-receipt.stage6l.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveFinalClosureBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveFinalClosureStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveFinalClosureOutcomeKnownToRepository, false);
  assert.ok(manifest.closureInputs.some((item) => item.key === "stage6l_release_archive_reconciliation_receipt"));
  assert.ok(manifest.externalClosureFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6M builds a ready closure from ready Stage 6L reconciliation receipt", () => {
  const report = buildProductionReleaseArchiveFinalClosure({
    manifest: readReleaseArchiveFinalClosureManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveFinalClosure, true);
  assert.equal(report.releaseArchiveReconciliationReceipt.status, "ready");
  assert.equal(report.releaseArchiveReconciliationReceipt.readyForExternalReleaseArchiveReconciliationReceipt, true);
  assert.equal(report.releaseArchiveFinalClosureStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveFinalClosureStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveFinalClosureOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.closureInputs.every((item) => item.present));
});

test("Stage 6M markdown summarizes closure and privacy boundary", () => {
  const report = buildProductionReleaseArchiveFinalClosure({
    manifest: readReleaseArchiveFinalClosureManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveFinalClosureMarkdown(report);
  assert.match(markdown, /Stage 6M production release archive final closure/);
  assert.match(markdown, /Ready for external release archive final closure: `true`/);
  assert.match(markdown, /Stage 6L archive reconciliation receipt status: `ready`/);
  assert.match(markdown, /External archive final closure stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6M rejects incomplete closure sections", () => {
  const manifest = readReleaseArchiveFinalClosureManifest();
  manifest.closureSections = manifest.closureSections.filter(
    (section) => section.key !== "final_archive_outcome_reference",
  );
  assert.throws(() => validateReleaseArchiveFinalClosureManifest(manifest), Stage6MReleaseArchiveFinalClosureError);
});

test("Stage 6M rejects external closure fields kept in git", () => {
  const manifest = readReleaseArchiveFinalClosureManifest();
  manifest.externalClosureFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveFinalClosureManifest(manifest), /failed validation/);
});

test("Stage 6M leak scanner blocks unsafe closure content", () => {
  assert.deepEqual(detectReleaseArchiveFinalClosureLeaks("safe redacted closure"), []);
  assert.deepEqual(detectReleaseArchiveFinalClosureLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveFinalClosureLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveFinalClosureLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6M argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6MArgs([
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
  assert.throws(() => parseStage6MArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6M CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6m-"));
  try {
    const summaryPath = join(dir, "closure.md");
    const jsonOut = join(dir, "closure.json");
    const result = runStage6MProductionReleaseArchiveFinalClosure({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6M production release archive final closure/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveFinalClosureStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6M CLI dry-run exits 0 and prints the closure", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6M production release archive final closure/);
  assert.match(result.stdout, /Ready for external release archive final closure: `true`/);
});

test("Stage 6M CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6m-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6M production release archive final closure/);
    assert.match(result.stdout, /Stage 6L archive reconciliation receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
