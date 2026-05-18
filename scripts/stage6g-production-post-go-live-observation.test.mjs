import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6GPostGoLiveObservationError,
  buildProductionPostGoLiveObservation,
  detectPostGoLiveObservationLeaks,
  parseStage6GArgs,
  readPostGoLiveObservationManifest,
  renderProductionPostGoLiveObservationMarkdown,
  runStage6GProductionPostGoLiveObservation,
  validatePostGoLiveObservationManifest,
} from "./stage6g-production-post-go-live-observation.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6g-production-post-go-live-observation.mjs");

test("Stage 6G validates the bundled post-go-live observation manifest", () => {
  const manifest = validatePostGoLiveObservationManifest(readPostGoLiveObservationManifest());
  assert.equal(manifest.stage, "6G");
  assert.equal(manifest.goLiveDecisionRecordManifest, "deploy/self-hosted/go-live-decision-record.stage6f.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.observationEvidenceStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.postGoLiveObservationBundledInRepository, false);
  assert.ok(manifest.observationInputs.length >= 8);
  assert.ok(manifest.observationSections.length >= 8);
  assert.ok(manifest.externalObservationFields.length >= 9);
  assert.ok(manifest.observationGates.length >= 10);
});

test("Stage 6G builds a ready post-go-live observation package from ready Stage 6F decision record", () => {
  const report = buildProductionPostGoLiveObservation({
    manifest: readPostGoLiveObservationManifest(),
    generatedAt: "2026-05-15T14:00:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalPostGoLiveObservation, true);
  assert.equal(report.observationEvidenceStoredOutsideGit, true);
  assert.equal(report.observationOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveServerGoLiveVerifiedByThisReport, false);
  assert.equal(report.liveObservationVerifiedByThisReport, false);
  assert.equal(report.repositoryContainsLiveLogs, false);
  assert.equal(report.repositoryContainsLiveMetrics, false);
  assert.equal(report.checks.stage6fReady, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6G markdown summarizes gates and privacy boundary", () => {
  const report = buildProductionPostGoLiveObservation({
    manifest: readPostGoLiveObservationManifest(),
    generatedAt: "2026-05-15T14:00:00.000Z",
  });
  const markdown = renderProductionPostGoLiveObservationMarkdown(report);
  assert.match(markdown, /Stage 6G production post-go-live observation/);
  assert.match(markdown, /Ready for external post-go-live observation: `true`/);
  assert.match(markdown, /Observation outcome known to repository: `false`/);
  assert.match(markdown, /Go-live approved by this report: `false`/);
  assert.match(markdown, /npm run preflight:stage6f/);
  assert.match(markdown, /manual external health and smoke review/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6G rejects incomplete observation sections", () => {
  const manifest = readPostGoLiveObservationManifest();
  manifest.observationSections = manifest.observationSections.filter((section) => section.key !== "rollback_watch");
  assert.throws(() => validatePostGoLiveObservationManifest(manifest), Stage6GPostGoLiveObservationError);
});

test("Stage 6G rejects external observation fields kept in git", () => {
  const manifest = readPostGoLiveObservationManifest();
  manifest.externalObservationFields[0] = { ...manifest.externalObservationFields[0], storeOutsideGit: false };
  assert.throws(() => validatePostGoLiveObservationManifest(manifest), Stage6GPostGoLiveObservationError);
});

test("Stage 6G leak scanner blocks unsafe observation content", () => {
  assert.deepEqual(detectPostGoLiveObservationLeaks("safe redacted post-go-live observation"), []);
  assert.ok(detectPostGoLiveObservationLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectPostGoLiveObservationLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6G argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6GArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6GArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6G CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6g-"));
  try {
    const summary = join(dir, "observation.md");
    const json = join(dir, "observation.json");
    const result = runStage6GProductionPostGoLiveObservation({
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

test("Stage 6G CLI dry-run exits 0 and prints the observation package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T14:00:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6G production post-go-live observation/);
  assert.match(result.stdout, /Status: `ready`/);
});

test("Stage 6G CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6g-cwd-"));
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
