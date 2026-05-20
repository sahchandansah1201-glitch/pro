import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliation,
  detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks,
  parseStage6WArgs,
  readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest,
  renderProductionReleaseArchiveRetentionCycleFinalClosureReconciliationMarkdown,
  runStage6WProductionReleaseArchiveRetentionCycleFinalClosureReconciliation,
  Stage6WReleaseArchiveRetentionCycleFinalClosureReconciliationError,
  validateReleaseArchiveRetentionCycleFinalClosureReconciliationManifest,
} from "./stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.mjs");

test("Stage 6W validates the bundled release archive retention cycle final closure reconciliation manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest());
  assert.equal(manifest.stage, "6W");
  assert.equal(manifest.releaseArchiveRetentionCycleFinalClosureReceiptManifest, "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleFinalClosureReconciliationBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository, false);
  assert.ok(manifest.reconciliationInputs.some((item) => item.key === "stage6v_release_archive_retention_cycle_final_closure_receipt"));
  assert.ok(manifest.externalReconciliationFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6W builds a ready reconciliation from ready Stage 6V receipt", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliation({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliation, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReceipt.status, "ready");
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReceipt.readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReceiptStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit, true);
  assert.equal(report.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.reconciliationInputs.every((item) => item.present));
});

test("Stage 6W markdown summarizes reconciliation and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliation({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleFinalClosureReconciliationMarkdown(report);
  assert.match(markdown, /Stage 6W production release archive retention cycle final closure reconciliation/);
  assert.match(markdown, /Ready for external release archive retention cycle final closure reconciliation: `true`/);
  assert.match(markdown, /Stage 6V archive retention cycle final closure receipt status: `ready`/);
  assert.match(markdown, /External archive retention cycle final closure reconciliation stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6W rejects incomplete reconciliation sections", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest();
  manifest.reconciliationSections = manifest.reconciliationSections.filter(
    (section) => section.key !== "final_closure_receipt_reconciliation_reference",
  );
  assert.throws(() => validateReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(manifest), Stage6WReleaseArchiveRetentionCycleFinalClosureReconciliationError);
});

test("Stage 6W rejects external reconciliation fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest();
  manifest.externalReconciliationFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(manifest), /failed validation/);
});

test("Stage 6W leak scanner blocks unsafe reconciliation content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks("safe redacted reconciliation"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6W argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6WArgs([
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
  assert.throws(() => parseStage6WArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6W CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6w-"));
  try {
    const summaryPath = join(dir, "reconciliation.md");
    const jsonOut = join(dir, "reconciliation.json");
    const result = runStage6WProductionReleaseArchiveRetentionCycleFinalClosureReconciliation({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6W production release archive retention cycle final closure reconciliation/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6W CLI dry-run exits 0 and prints the reconciliation", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6W production release archive retention cycle final closure reconciliation/);
  assert.match(result.stdout, /Ready for external release archive retention cycle final closure reconciliation: `true`/);
});

test("Stage 6W CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6w-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6W production release archive retention cycle final closure reconciliation/);
    assert.match(result.stdout, /Stage 6V archive retention cycle final closure receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
