import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveRetentionRegister,
  detectReleaseArchiveRetentionRegisterLeaks,
  parseStage6OArgs,
  readReleaseArchiveRetentionRegisterManifest,
  renderProductionReleaseArchiveRetentionRegisterMarkdown,
  runStage6OProductionReleaseArchiveRetentionRegister,
  Stage6OReleaseArchiveRetentionRegisterError,
  validateReleaseArchiveRetentionRegisterManifest,
} from "./stage6o-production-release-archive-retention-register.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6o-production-release-archive-retention-register.mjs");

test("Stage 6O validates the bundled release archive retention register manifest", () => {
  const manifest = validateReleaseArchiveRetentionRegisterManifest(readReleaseArchiveRetentionRegisterManifest());
  assert.equal(manifest.stage, "6O");
  assert.equal(
    manifest.releaseArchiveFinalClosureReceiptManifest,
    "deploy/self-hosted/release-archive-final-closure-receipt.stage6n.json",
  );
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.releaseArchiveRetentionRegisterBundledInRepository, true);
  assert.equal(manifest.productBoundary.externalArchiveRetentionRecordsStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveRetentionOutcomeKnownToRepository, false);
  assert.ok(manifest.registerInputs.some((item) => item.key === "stage6n_release_archive_final_closure_receipt"));
  assert.ok(manifest.externalRetentionFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6O builds a ready register from ready Stage 6N final closure receipt", () => {
  const report = buildProductionReleaseArchiveRetentionRegister({
    manifest: readReleaseArchiveRetentionRegisterManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionRegister, true);
  assert.equal(report.releaseArchiveFinalClosureReceipt.status, "ready");
  assert.equal(report.releaseArchiveFinalClosureReceipt.readyForExternalReleaseArchiveFinalClosureReceipt, true);
  assert.equal(report.releaseArchiveRetentionRegisterStoredInGit, true);
  assert.equal(report.releaseArchiveFinalClosureReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveFinalClosureStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationReceiptStoredInGit, true);
  assert.equal(report.releaseArchiveReconciliationStoredInGit, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.externalArchiveFinalClosureReceiptStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionRecordsStoredOutsideGit, true);
  assert.equal(report.archiveFinalClosureReceiptOutcomeKnownToRepository, false);
  assert.equal(report.archiveRetentionOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.registerInputs.every((item) => item.present));
});

test("Stage 6O markdown summarizes retention and privacy boundary", () => {
  const report = buildProductionReleaseArchiveRetentionRegister({
    manifest: readReleaseArchiveRetentionRegisterManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveRetentionRegisterMarkdown(report);
  assert.match(markdown, /Stage 6O production release archive retention register/);
  assert.match(markdown, /Ready for external release archive retention register: `true`/);
  assert.match(markdown, /Stage 6N archive final closure receipt status: `ready`/);
  assert.match(markdown, /External archive retention records stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6O rejects incomplete register sections", () => {
  const manifest = readReleaseArchiveRetentionRegisterManifest();
  manifest.registerSections = manifest.registerSections.filter(
    (section) => section.key !== "archive_retention_schedule_reference",
  );
  assert.throws(
    () => validateReleaseArchiveRetentionRegisterManifest(manifest),
    Stage6OReleaseArchiveRetentionRegisterError,
  );
});

test("Stage 6O rejects external retention fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionRegisterManifest();
  manifest.externalRetentionFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionRegisterManifest(manifest), /failed validation/);
});

test("Stage 6O leak scanner blocks unsafe retention content", () => {
  assert.deepEqual(detectReleaseArchiveRetentionRegisterLeaks("safe redacted register"), []);
  assert.deepEqual(detectReleaseArchiveRetentionRegisterLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveRetentionRegisterLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveRetentionRegisterLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6O argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6OArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-19T12:10:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-19T12:10:00.000Z",
  });
  assert.throws(() => parseStage6OArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6O CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6o-"));
  try {
    const summaryPath = join(dir, "retention.md");
    const jsonOut = join(dir, "retention.json");
    const result = runStage6OProductionReleaseArchiveRetentionRegister({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-19T12:20:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6O production release archive retention register/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveRetentionRecordsStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6O CLI dry-run exits 0 and prints the register", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6O production release archive retention register/);
  assert.match(result.stdout, /Ready for external release archive retention register: `true`/);
});

test("Stage 6O CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6o-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6O production release archive retention register/);
    assert.match(result.stdout, /Stage 6N archive final closure receipt status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
