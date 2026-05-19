import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveFinalClosureReceipt,
  detectReleaseArchiveFinalClosureReceiptLeaks,
  parseStage6NArgs,
  readReleaseArchiveFinalClosureReceiptManifest,
  renderProductionReleaseArchiveFinalClosureReceiptMarkdown,
  runStage6NProductionReleaseArchiveFinalClosureReceipt,
  Stage6NReleaseArchiveFinalClosureReceiptError,
  validateReleaseArchiveFinalClosureReceiptManifest,
} from "./stage6n-production-release-archive-final-closure-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6n-production-release-archive-final-closure-receipt.mjs");

test("Stage 6N validates the bundled release archive final closure receipt manifest", () => {
  const manifest = validateReleaseArchiveFinalClosureReceiptManifest(readReleaseArchiveFinalClosureReceiptManifest());
  assert.equal(manifest.stage, "6N");
  assert.equal(
    manifest.releaseArchiveFinalClosureManifest,
    "deploy/self-hosted/release-archive-final-closure.stage6m.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveFinalClosureReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveFinalClosureReceiptStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveFinalClosureReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.receiptInputs.some((item) => item.key === "stage6m_release_archive_final_closure"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6N builds a ready receipt from ready Stage 6M final closure", () => {
  const report = buildProductionReleaseArchiveFinalClosureReceipt({
    manifest: readReleaseArchiveFinalClosureReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveFinalClosureReceipt, true);
  assert.equal(report.releaseArchiveFinalClosure.status, "ready");
  assert.equal(report.releaseArchiveFinalClosure.readyForExternalReleaseArchiveFinalClosure, true);
  assert.equal(report.releaseArchiveFinalClosureReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveFinalClosureStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveFinalClosureStoredOutsideGit, true);
  assert.equal(report.externalArchiveFinalClosureReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveReconciliationOutcomeKnownToRepository, false);
  assert.equal(report.archiveFinalClosureOutcomeKnownToRepository, false);
  assert.equal(report.archiveFinalClosureReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.receiptInputs.every((item) => item.present));
});

test("Stage 6N markdown summarizes closure and privacy boundary", () => {
  const report = buildProductionReleaseArchiveFinalClosureReceipt({
    manifest: readReleaseArchiveFinalClosureReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveFinalClosureReceiptMarkdown(report);
  assert.match(markdown, /Stage 6N production release archive final closure receipt/);
  assert.match(markdown, /Ready for external release archive final closure receipt: `true`/);
  assert.match(markdown, /Stage 6M archive final closure status: `ready`/);
  assert.match(markdown, /External archive final closure receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6N rejects incomplete receipt sections", () => {
  const manifest = readReleaseArchiveFinalClosureReceiptManifest();
  manifest.receiptSections = manifest.receiptSections.filter(
    (section) => section.key !== "final_archive_closure_outcome_reference",
  );
  assert.throws(
    () => validateReleaseArchiveFinalClosureReceiptManifest(manifest),
    Stage6NReleaseArchiveFinalClosureReceiptError,
  );
});

test("Stage 6N rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveFinalClosureReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveFinalClosureReceiptManifest(manifest), /failed validation/);
});

test("Stage 6N leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveFinalClosureReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveFinalClosureReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveFinalClosureReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveFinalClosureReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6N argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6NArgs([
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
  assert.throws(() => parseStage6NArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6N CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6n-"));
  try {
    const summaryPath = join(dir, "closure.md");
    const jsonOut = join(dir, "closure.json");
    const result = runStage6NProductionReleaseArchiveFinalClosureReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6N production release archive final closure receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveFinalClosureReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6N CLI dry-run exits 0 and prints the closure", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6N production release archive final closure receipt/);
  assert.match(result.stdout, /Ready for external release archive final closure receipt: `true`/);
});

test("Stage 6N CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6n-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6N production release archive final closure receipt/);
  assert.match(result.stdout, /Stage 6M archive final closure status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
