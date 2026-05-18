import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6HReleaseMemoryClosureError,
  buildProductionReleaseMemoryClosure,
  detectReleaseMemoryClosureLeaks,
  parseStage6HArgs,
  readReleaseMemoryClosureManifest,
  renderProductionReleaseMemoryClosureMarkdown,
  runStage6HProductionReleaseMemoryClosure,
  validateReleaseMemoryClosureManifest,
} from "./stage6h-production-release-memory-closure.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6h-production-release-memory-closure.mjs");

test("Stage 6H validates the bundled release memory closure manifest", () => {
  const manifest = validateReleaseMemoryClosureManifest(readReleaseMemoryClosureManifest());
  assert.equal(manifest.stage, "6H");
  assert.equal(manifest.postGoLiveObservationManifest, "deploy/self-hosted/post-go-live-observation.stage6g.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.closureEvidenceStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.releaseMemoryClosureBundledInRepository, false);
  assert.ok(manifest.closureInputs.length >= 10);
  assert.ok(manifest.closureSections.length >= 8);
  assert.ok(manifest.externalClosureFields.length >= 9);
  assert.ok(manifest.closureGates.length >= 10);
});

test("Stage 6H builds a ready release memory closure package from ready Stage 6G observation", () => {
  const report = buildProductionReleaseMemoryClosure({
    manifest: readReleaseMemoryClosureManifest(),
    generatedAt: "2026-05-15T14:00:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseMemoryClosure, true);
  assert.equal(report.closureEvidenceStoredOutsideGit, true);
  assert.equal(report.closureOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveServerGoLiveVerifiedByThisReport, false);
  assert.equal(report.liveClosureVerifiedByThisReport, false);
  assert.equal(report.repositoryContainsLiveLogs, false);
  assert.equal(report.repositoryContainsLiveMetrics, false);
  assert.equal(report.checks.stage6gReady, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6H markdown summarizes gates and privacy boundary", () => {
  const report = buildProductionReleaseMemoryClosure({
    manifest: readReleaseMemoryClosureManifest(),
    generatedAt: "2026-05-15T14:00:00.000Z",
  });
  const markdown = renderProductionReleaseMemoryClosureMarkdown(report);
  assert.match(markdown, /Stage 6H production release memory closure/);
  assert.match(markdown, /Ready for external release memory closure: `true`/);
  assert.match(markdown, /Closure outcome known to repository: `false`/);
  assert.match(markdown, /Go-live approved by this report: `false`/);
  assert.match(markdown, /npm run preflight:stage6g/);
  assert.match(markdown, /manual external health and smoke review/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6H rejects incomplete closure sections", () => {
  const manifest = readReleaseMemoryClosureManifest();
  manifest.closureSections = manifest.closureSections.filter((section) => section.key !== "rollback_watch");
  assert.throws(() => validateReleaseMemoryClosureManifest(manifest), Stage6HReleaseMemoryClosureError);
});

test("Stage 6H rejects external closure fields kept in git", () => {
  const manifest = readReleaseMemoryClosureManifest();
  manifest.externalClosureFields[0] = { ...manifest.externalClosureFields[0], storeOutsideGit: false };
  assert.throws(() => validateReleaseMemoryClosureManifest(manifest), Stage6HReleaseMemoryClosureError);
});

test("Stage 6H leak scanner blocks unsafe closure content", () => {
  assert.deepEqual(detectReleaseMemoryClosureLeaks("safe redacted release memory closure"), []);
  assert.ok(detectReleaseMemoryClosureLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectReleaseMemoryClosureLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6H argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6HArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6HArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6H CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6h-"));
  try {
    const summary = join(dir, "closure.md");
    const json = join(dir, "closure.json");
    const result = runStage6HProductionReleaseMemoryClosure({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T14:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.equal(existsSync(summary), true);
    assert.equal(existsSync(json), true);
    assert.match(readFileSync(summary, "utf8"), /Status: `ready`/);
    assert.equal(JSON.parse(readFileSync(json, "utf8")).status, "ready");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6H CLI dry-run exits 0 and prints the closure package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T14:00:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6H production release memory closure/);
  assert.match(result.stdout, /Status: `ready`/);
});

test("Stage 6H CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6h-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T14:00:00.000Z"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
