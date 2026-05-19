import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveReconciliation,
  detectReleaseArchiveReconciliationLeaks,
  parseStage6KArgs,
  readReleaseArchiveReconciliationManifest,
  renderProductionReleaseArchiveReconciliationMarkdown,
  runStage6KProductionReleaseArchiveReconciliation,
  Stage6KReleaseArchiveReconciliationError,
  validateReleaseArchiveReconciliationManifest,
} from "./stage6k-production-release-archive-reconciliation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6k-production-release-archive-reconciliation.mjs");

test("Stage 6K validates the bundled release archive reconciliation manifest", () => {
  const manifest = validateReleaseArchiveReconciliationManifest(readReleaseArchiveReconciliationManifest());
  assert.equal(manifest.stage, "6K");
  assert.equal(manifest.releaseArchiveHandoffReceiptManifest, "deploy/self-hosted/release-archive-handoff-receipt.stage6j.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveReconciliationBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveReconciliationStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveReconciliationOutcomeKnownToRepository, false);
  assert.ok(manifest.reconciliationInputs.some((item) => item.key === "stage6j_release_archive_handoff_receipt"));
  assert.ok(manifest.externalReconciliationFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6K builds a ready reconciliation from ready Stage 6J receipt", () => {
  const report = buildProductionReleaseArchiveReconciliation({
    manifest: readReleaseArchiveReconciliationManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveReconciliation, true);
  assert.equal(report.releaseArchiveHandoffReceipt.status, "ready");
  assert.equal(report.releaseArchiveHandoffReceipt.readyForExternalReleaseArchiveHandoffReceipt, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.archiveHandoffReceiptStoredInGit, true);
  assert.equal(report.externalArchiveReconciliationStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.reconciliationInputs.every((item) => item.present));
});

test("Stage 6K markdown summarizes reconciliation and privacy boundary", () => {
  const report = buildProductionReleaseArchiveReconciliation({
    manifest: readReleaseArchiveReconciliationManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveReconciliationMarkdown(report);
  assert.match(markdown, /Stage 6K production release archive reconciliation/);
  assert.match(markdown, /Ready for external release archive reconciliation: `true`/);
  assert.match(markdown, /Stage 6J archive handoff receipt status: `ready`/);
  assert.match(markdown, /External archive reconciliation stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6K rejects incomplete reconciliation sections", () => {
  const manifest = readReleaseArchiveReconciliationManifest();
  manifest.reconciliationSections = manifest.reconciliationSections.filter(
    (section) => section.key !== "restore_drill_reconciliation_reference",
  );
  assert.throws(() => validateReleaseArchiveReconciliationManifest(manifest), Stage6KReleaseArchiveReconciliationError);
});

test("Stage 6K rejects external reconciliation fields kept in git", () => {
  const manifest = readReleaseArchiveReconciliationManifest();
  manifest.externalReconciliationFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveReconciliationManifest(manifest), /failed validation/);
});

test("Stage 6K leak scanner blocks unsafe reconciliation content", () => {
  assert.deepEqual(detectReleaseArchiveReconciliationLeaks("safe redacted reconciliation"), []);
  assert.deepEqual(detectReleaseArchiveReconciliationLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveReconciliationLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveReconciliationLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6K argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6KArgs([
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
  assert.throws(() => parseStage6KArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6K CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6k-"));
  try {
    const summaryPath = join(dir, "reconciliation.md");
    const jsonOut = join(dir, "reconciliation.json");
    const result = runStage6KProductionReleaseArchiveReconciliation({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6K production release archive reconciliation/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveReconciliationStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6K CLI dry-run exits 0 and prints the reconciliation", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6K production release archive reconciliation/);
  assert.match(result.stdout, /Ready for external release archive reconciliation: `true`/);
});

test("Stage 6K CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6k-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6K production release archive reconciliation/);
    assert.match(result.stdout, /Stage 6J archive handoff receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
