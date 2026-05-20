import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt,
  detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks,
  parseStage6VArgs,
  readReleaseArchiveRetentionCycleFinalClosureReceiptManifest,
  renderProductionReleaseArchiveRetentionCycleFinalClosureReceiptMarkdown,
  runStage6VProductionReleaseArchiveRetentionCycleFinalClosureReceipt,
  Stage6VReleaseArchiveRetentionCycleFinalClosureReceiptError,
  validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest,
} from "./stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs");

test("Stage 6V validates the bundled release archive retention cycle final closure receipt manifest", () => {
  const manifest = validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest(readReleaseArchiveRetentionCycleFinalClosureReceiptManifest());
  assert.equal(manifest.stage, "6V");
  assert.equal(
    manifest.releaseArchiveRetentionCycleFinalClosureManifest,
    "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionCycleFinalClosureReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6u_release_archive_retention_cycle_final_closure"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6V builds a ready receipt from ready Stage 6U retention cycle final closure", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosure.status, "ready");
  assert.equal(report.releaseArchiveRetentionCycleFinalClosure.readyForExternalReleaseArchiveRetentionCycleFinalClosure, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveRetentionCycleFinalClosureStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleFinalClosureOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6V keeps Stage 6U readiness tied to the Stage 6U manifest timestamp", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(),
    root: ROOT,
    generatedAt: "2035-01-01T00:00:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.generatedAt, "2035-01-01T00:00:00.000Z");
  assert.equal(report.releaseArchiveRetentionCycleFinalClosure.status, "ready");
});

test("Stage 6V markdown summarizes closure and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
    manifest: readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleFinalClosureReceiptMarkdown(report);
  assert.match(markdown, /Stage 6V production release archive retention cycle final closure receipt/);
  assert.match(markdown, /Ready for external release archive retention cycle final closure receipt: `true`/);
  assert.match(markdown, /Stage 6U archive retention cycle final closure status: `ready`/);
  assert.match(markdown, /External archive retention cycle final closure receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6V rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "final_archive_retention_cycle_final_closure_outcome_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest(manifest),
    Stage6VReleaseArchiveRetentionCycleFinalClosureReceiptError,
  );
});

test("Stage 6V rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest(manifest), /failed validation/);
});

test("Stage 6V leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6V argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6VArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T15:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T15:00:00.000Z",
  });
  assert.throws(() => parseStage6VArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6V CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6v-"));
  try {
    const summaryPath = join(dir, "closure.md");
    const jsonOut = join(dir, "closure.json");
    const result = runStage6VProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T15:45:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6V production release archive retention cycle final closure receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6V CLI dry-run exits 0 and prints the closure", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6V production release archive retention cycle final closure receipt/);
  assert.match(result.stdout, /Ready for external release archive retention cycle final closure receipt: `true`/);
});

test("Stage 6V CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6v-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6V production release archive retention cycle final closure receipt/);
    assert.match(result.stdout, /Stage 6U archive retention cycle final closure status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
