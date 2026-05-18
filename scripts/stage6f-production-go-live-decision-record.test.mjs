import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6FGoLiveDecisionRecordError,
  buildProductionGoLiveDecisionRecord,
  detectGoLiveDecisionRecordLeaks,
  parseStage6FArgs,
  readGoLiveDecisionRecordManifest,
  renderProductionGoLiveDecisionRecordMarkdown,
  runStage6FProductionGoLiveDecisionRecord,
  validateGoLiveDecisionRecordManifest,
} from "./stage6f-production-go-live-decision-record.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6f-production-go-live-decision-record.mjs");

test("Stage 6F validates the bundled go-live decision record manifest", () => {
  const manifest = validateGoLiveDecisionRecordManifest(readGoLiveDecisionRecordManifest());
  assert.equal(manifest.stage, "6F");
  assert.equal(manifest.goLiveHandoffManifest, "deploy/self-hosted/go-live-handoff.stage6e.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.finalDecisionStoredOutsideGit, true);
  assert.equal(manifest.productBoundary.goLiveDecisionRecordBundledInRepository, false);
  assert.ok(manifest.decisionRecordInputs.length >= 8);
  assert.ok(manifest.decisionRecordSections.length >= 8);
  assert.ok(manifest.externalDecisionFields.length >= 8);
  assert.ok(manifest.decisionGates.length >= 8);
});

test("Stage 6F builds a ready decision-record contract from ready Stage 6E handoff", () => {
  const report = buildProductionGoLiveDecisionRecord({
    manifest: readGoLiveDecisionRecordManifest(),
    generatedAt: "2026-05-15T13:30:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalGoLiveDecisionRecord, true);
  assert.equal(report.finalDecisionStoredOutsideGit, true);
  assert.equal(report.finalGoLiveOutcomeKnownToRepository, false);
  assert.equal(report.goLiveApprovedByThisReport, false);
  assert.equal(report.liveServerGoLiveVerifiedByThisReport, false);
  assert.equal(report.checks.stage6eReady, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6F markdown summarizes gates and privacy boundary", () => {
  const report = buildProductionGoLiveDecisionRecord({
    manifest: readGoLiveDecisionRecordManifest(),
    generatedAt: "2026-05-15T13:30:00.000Z",
  });
  const markdown = renderProductionGoLiveDecisionRecordMarkdown(report);
  assert.match(markdown, /Stage 6F production go-live decision record/);
  assert.match(markdown, /Ready for external go-live decision record: `true`/);
  assert.match(markdown, /Final go-live outcome known to repository: `false`/);
  assert.match(markdown, /Go-live approved by this report: `false`/);
  assert.match(markdown, /npm run preflight:stage6e/);
  assert.match(markdown, /manual external decision record/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6F rejects incomplete decision sections", () => {
  const manifest = readGoLiveDecisionRecordManifest();
  manifest.decisionRecordSections = manifest.decisionRecordSections.filter((section) => section.key !== "rollback_authority");
  assert.throws(() => validateGoLiveDecisionRecordManifest(manifest), Stage6FGoLiveDecisionRecordError);
});

test("Stage 6F rejects external decision fields kept in git", () => {
  const manifest = readGoLiveDecisionRecordManifest();
  manifest.externalDecisionFields[0] = { ...manifest.externalDecisionFields[0], storeOutsideGit: false };
  assert.throws(() => validateGoLiveDecisionRecordManifest(manifest), Stage6FGoLiveDecisionRecordError);
});

test("Stage 6F leak scanner blocks unsafe decision-record content", () => {
  assert.deepEqual(detectGoLiveDecisionRecordLeaks("safe redacted go-live decision record"), []);
  assert.ok(detectGoLiveDecisionRecordLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectGoLiveDecisionRecordLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6F argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6FArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6FArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6F CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6f-"));
  try {
    const summary = join(dir, "decision.md");
    const json = join(dir, "decision.json");
    const result = runStage6FProductionGoLiveDecisionRecord({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T13:30:00.000Z",
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

test("Stage 6F CLI dry-run exits 0 and prints the decision-record package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T13:30:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6F production go-live decision record/);
  assert.match(result.stdout, /Status: `ready`/);
});

test("Stage 6F CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6f-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T13:30:00.000Z"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
