import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveHandoffReceipt,
  detectReleaseArchiveHandoffReceiptLeaks,
  parseStage6JArgs,
  readReleaseArchiveHandoffReceiptManifest,
  renderProductionReleaseArchiveHandoffReceiptMarkdown,
  runStage6JProductionReleaseArchiveHandoffReceipt,
  Stage6JReleaseArchiveHandoffReceiptError,
  validateReleaseArchiveHandoffReceiptManifest,
} from "./stage6j-production-release-archive-handoff-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6j-production-release-archive-handoff-receipt.mjs");

test("Stage 6J validates the bundled release archive handoff receipt manifest", () => {
  const manifest = validateReleaseArchiveHandoffReceiptManifest(readReleaseArchiveHandoffReceiptManifest());
  assert.equal(manifest.stage, "6J");
  assert.equal(manifest.releaseArchiveIndexManifest, "deploy/self-hosted/release-archive-index.stage6i.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.archiveHandoffReceiptBundledInRepository, true);
  assert.equal(manifest.productBoundary.releaseArchiveContentsStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.archiveReceiptOutcomeKnownToRepository, false);
  assert.ok(manifest.handoffInputs.some((item) => item.key === "stage6i_release_archive_index"));
  assert.ok(manifest.externalReceiptFields.every((item) => item.storeOutsideGit === true));
});

test("Stage 6J builds a ready archive handoff receipt from ready Stage 6I index", () => {
  const report = buildProductionReleaseArchiveHandoffReceipt({
    manifest: readReleaseArchiveHandoffReceiptManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveHandoffReceipt, true);
  assert.equal(report.releaseArchiveIndex.status, "ready");
  assert.equal(report.releaseArchiveIndex.readyForExternalReleaseArchiveIndex, true);
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.archiveHandoffReceiptStoredInGit, true);
  assert.equal(report.externalArchiveReceiptStoredOutsideGit, true);
  assert.equal(report.archiveReceiptOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.handoffInputs.every((item) => item.present));
});

test("Stage 6J markdown summarizes archive handoff receipt and privacy boundary", () => {
  const report = buildProductionReleaseArchiveHandoffReceipt({
    manifest: readReleaseArchiveHandoffReceiptManifest(),
    root: ROOT,
  });
  const markdown = renderProductionReleaseArchiveHandoffReceiptMarkdown(report);
  assert.match(markdown, /Stage 6J production release archive handoff receipt/);
  assert.match(markdown, /Ready for external release archive handoff receipt: `true`/);
  assert.match(markdown, /Stage 6I release archive index status: `ready`/);
  assert.match(markdown, /Release archive contents stored outside git: `true`/);
  assert.match(markdown, /External archive receipt stored outside git: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6J rejects incomplete handoff sections", () => {
  const manifest = readReleaseArchiveHandoffReceiptManifest();
  manifest.handoffSections = manifest.handoffSections.filter((section) => section.key !== "restore_drill_reference");
  assert.throws(() => validateReleaseArchiveHandoffReceiptManifest(manifest), Stage6JReleaseArchiveHandoffReceiptError);
});

test("Stage 6J rejects external receipt fields kept in git", () => {
  const manifest = readReleaseArchiveHandoffReceiptManifest();
  manifest.externalReceiptFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveHandoffReceiptManifest(manifest), /failed validation/);
});

test("Stage 6J leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectReleaseArchiveHandoffReceiptLeaks("safe redacted receipt"), []);
  assert.deepEqual(detectReleaseArchiveHandoffReceiptLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveHandoffReceiptLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveHandoffReceiptLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6J argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6JArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-17T15:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-17T15:00:00.000Z",
  });
  assert.throws(() => parseStage6JArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6J CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6j-"));
  try {
    const summaryPath = join(dir, "receipt.md");
    const jsonOut = join(dir, "receipt.json");
    const result = runStage6JProductionReleaseArchiveHandoffReceipt({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-17T16:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6J production release archive handoff receipt/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.externalArchiveReceiptStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6J CLI dry-run exits 0 and prints the handoff receipt", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6J production release archive handoff receipt/);
  assert.match(result.stdout, /Ready for external release archive handoff receipt: `true`/);
});

test("Stage 6J CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6j-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6J production release archive handoff receipt/);
    assert.match(result.stdout, /Stage 6I release archive index status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
