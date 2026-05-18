import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildProductionReleaseArchiveIndex,
  detectReleaseArchiveIndexLeaks,
  parseStage6IArgs,
  readReleaseArchiveIndexManifest,
  renderProductionReleaseArchiveIndexMarkdown,
  runStage6IProductionReleaseArchiveIndex,
  Stage6IReleaseArchiveIndexError,
  validateReleaseArchiveIndexManifest,
} from "./stage6i-production-release-archive-index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/stage6i-production-release-archive-index.mjs");

test("Stage 6I validates the bundled release archive index manifest", () => {
  const manifest = validateReleaseArchiveIndexManifest(readReleaseArchiveIndexManifest());
  assert.equal(manifest.stage, "6I");
  assert.equal(manifest.releaseMemoryClosureManifest, "deploy/self-hosted/release-memory-closure.stage6h.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.archiveIndexBundledInRepository, true);
  assert.equal(manifest.productBoundary.releaseArchiveContentsStoredOutsideGit, true);
  assert.ok(manifest.archiveInputs.some((item) => item.key === "stage6h_release_memory_closure"));
  assert.ok(manifest.externalArchiveRecords.every((item) => item.storeOutsideGit === true));
});

test("Stage 6I builds a ready release archive index from ready Stage 6H closure", () => {
  const report = buildProductionReleaseArchiveIndex({
    manifest: readReleaseArchiveIndexManifest(),
    root: ROOT,
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveIndex, true);
  assert.equal(report.releaseMemoryClosure.status, "ready");
  assert.equal(report.releaseArchiveIndexStoredInGit, true);
  assert.equal(report.releaseArchiveContentsStoredOutsideGit, true);
  assert.equal(report.archiveOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveArchiveVerifiedByThisReport, false);
  assert.deepEqual(report.leakFindings, []);
  assert.ok(report.stageManifests.every((item) => item.present));
});

test("Stage 6I markdown summarizes manifest chain and privacy boundary", () => {
  const report = buildProductionReleaseArchiveIndex({ manifest: readReleaseArchiveIndexManifest(), root: ROOT });
  const markdown = renderProductionReleaseArchiveIndexMarkdown(report);
  assert.match(markdown, /Stage 6I production release archive index/);
  assert.match(markdown, /Ready for external release archive index: `true`/);
  assert.match(markdown, /Stage 6H release memory closure status: `ready`/);
  assert.match(markdown, /Release archive contents stored outside git: `true`/);
  assert.match(markdown, /deploy\/self-hosted\/acceptance-baseline\.stage6a\.json/);
  assert.match(markdown, /Managed runtime\/database dependency: none/);
});

test("Stage 6I rejects incomplete archive sections", () => {
  const manifest = readReleaseArchiveIndexManifest();
  manifest.archiveSections = manifest.archiveSections.filter((section) => section.key !== "retention_policy");
  assert.throws(() => validateReleaseArchiveIndexManifest(manifest), Stage6IReleaseArchiveIndexError);
});

test("Stage 6I rejects external archive records kept in git", () => {
  const manifest = readReleaseArchiveIndexManifest();
  manifest.externalArchiveRecords[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveIndexManifest(manifest), /failed validation/);
});

test("Stage 6I leak scanner blocks unsafe archive content", () => {
  assert.deepEqual(detectReleaseArchiveIndexLeaks("safe redacted archive index"), []);
  assert.deepEqual(detectReleaseArchiveIndexLeaks("Authorization: Bearer real-token"), ["bearer token"]);
  assert.deepEqual(detectReleaseArchiveIndexLeaks("patient_full_name=Example Person"), ["patient identity"]);
  assert.deepEqual(detectReleaseArchiveIndexLeaks("storage_object_path=private/path"), ["storage path"]);
});

test("Stage 6I argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6IArgs([
    "--dry-run",
    "--manifest", "custom.json",
    "--summary", "out.md",
    "--json-out", "out.json",
    "--now", "2026-05-16T15:00:00.000Z",
  ]);
  assert.deepEqual(parsed, {
    dryRun: true,
    manifest: "custom.json",
    summaryPath: "out.md",
    jsonOut: "out.json",
    now: "2026-05-16T15:00:00.000Z",
  });
  assert.throws(() => parseStage6IArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6I CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6i-"));
  try {
    const summaryPath = join(dir, "archive.md");
    const jsonOut = join(dir, "archive.json");
    const result = runStage6IProductionReleaseArchiveIndex({
      summaryPath,
      jsonOut,
      generatedAt: "2026-05-16T16:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6I production release archive index/);
    const json = JSON.parse(readFileSync(jsonOut, "utf8"));
    assert.equal(json.status, "ready");
    assert.equal(json.releaseArchiveContentsStoredOutsideGit, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6I CLI dry-run exits 0 and prints the archive index", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6I production release archive index/);
  assert.match(result.stdout, /Ready for external release archive index: `true`/);
});

test("Stage 6I CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6i-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6I production release archive index/);
    assert.match(result.stdout, /Stage 6H release memory closure status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
