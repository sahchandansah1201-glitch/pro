import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6EGoLiveHandoffError,
  buildProductionGoLiveHandoff,
  detectGoLiveHandoffLeaks,
  parseStage6EArgs,
  readGoLiveHandoffManifest,
  renderProductionGoLiveHandoffMarkdown,
  runStage6EProductionGoLiveHandoff,
  validateGoLiveHandoffManifest,
} from "./stage6e-production-go-live-handoff.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6e-production-go-live-handoff.mjs");

test("Stage 6E validates the bundled go-live handoff manifest", () => {
  const manifest = validateGoLiveHandoffManifest(readGoLiveHandoffManifest());
  assert.equal(manifest.stage, "6E");
  assert.equal(manifest.liveInstallEvidenceManifest, "deploy/self-hosted/live-install-evidence.stage6d.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.goLiveDecisionBundledInRepository, false);
  assert.ok(manifest.handoffInputs.length >= 10);
  assert.ok(manifest.handoffSections.length >= 8);
  assert.ok(manifest.goLiveGates.length >= 8);
});

test("Stage 6E builds a ready handoff package from ready Stage 6D receipt package", () => {
  const report = buildProductionGoLiveHandoff({
    manifest: readGoLiveHandoffManifest(),
    generatedAt: "2026-05-15T13:00:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForOperatorGoLiveDecision, true);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveServerGoLiveVerifiedByThisReport, false);
  assert.equal(report.checks.stage6dReady, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6E markdown summarizes gates and privacy boundary", () => {
  const report = buildProductionGoLiveHandoff({
    manifest: readGoLiveHandoffManifest(),
    generatedAt: "2026-05-15T13:00:00.000Z",
  });
  const markdown = renderProductionGoLiveHandoffMarkdown(report);
  assert.match(markdown, /Stage 6E production go-live handoff/);
  assert.match(markdown, /Ready for operator go-live decision: `true`/);
  assert.match(markdown, /Go-live approved by this report: `false`/);
  assert.match(markdown, /npm run preflight:stage6d/);
  assert.match(markdown, /manual external approval/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6E rejects incomplete handoff sections", () => {
  const manifest = readGoLiveHandoffManifest();
  manifest.handoffSections = manifest.handoffSections.filter((section) => section.key !== "operator_contacts");
  assert.throws(() => validateGoLiveHandoffManifest(manifest), Stage6EGoLiveHandoffError);
});

test("Stage 6E rejects decision fields kept in git", () => {
  const manifest = readGoLiveHandoffManifest();
  manifest.decisionFields[0] = { ...manifest.decisionFields[0], storeOutsideGit: false };
  assert.throws(() => validateGoLiveHandoffManifest(manifest), Stage6EGoLiveHandoffError);
});

test("Stage 6E leak scanner blocks unsafe handoff content", () => {
  assert.deepEqual(detectGoLiveHandoffLeaks("safe redacted go-live handoff"), []);
  assert.ok(detectGoLiveHandoffLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectGoLiveHandoffLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6E argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6EArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6EArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6E CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6e-"));
  try {
    const summary = join(dir, "handoff.md");
    const json = join(dir, "handoff.json");
    const result = runStage6EProductionGoLiveHandoff({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T13:00:00.000Z",
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

test("Stage 6E CLI dry-run exits 0 and prints the handoff package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T13:00:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6E production go-live handoff/);
  assert.match(result.stdout, /Status: `ready`/);
});

test("Stage 6E CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6e-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T13:00:00.000Z"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
