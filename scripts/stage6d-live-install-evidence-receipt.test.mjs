import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6DLiveInstallEvidenceError,
  buildLiveInstallEvidenceReceipt,
  detectLiveInstallEvidenceLeaks,
  parseStage6DArgs,
  readLiveInstallEvidenceManifest,
  renderLiveInstallEvidenceReceiptMarkdown,
  runStage6DLiveInstallEvidenceReceipt,
  validateLiveInstallEvidenceManifest,
} from "./stage6d-live-install-evidence-receipt.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6d-live-install-evidence-receipt.mjs");

test("Stage 6D validates the bundled live install evidence manifest", () => {
  const manifest = validateLiveInstallEvidenceManifest(readLiveInstallEvidenceManifest());
  assert.equal(manifest.stage, "6D");
  assert.equal(manifest.installVerificationManifest, "deploy/self-hosted/install-verification.stage6c.json");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.liveEvidenceBundledInRepository, false);
  assert.ok(manifest.receiptInputs.length >= 10);
  assert.ok(manifest.evidenceCategories.length >= 8);
  assert.ok(manifest.receiptGates.length >= 7);
});

test("Stage 6D builds a ready receipt package from ready Stage 6C verification package", () => {
  const report = buildLiveInstallEvidenceReceipt({
    manifest: readLiveInstallEvidenceManifest(),
    generatedAt: "2026-05-15T12:30:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForLiveInstallEvidenceReceipt, true);
  assert.equal(report.liveInstallEvidenceAccepted, false);
  assert.equal(report.liveInstallVerified, false);
  assert.equal(report.checks.stage6cReady, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6D markdown summarizes receipt categories and privacy boundary", () => {
  const report = buildLiveInstallEvidenceReceipt({
    manifest: readLiveInstallEvidenceManifest(),
    generatedAt: "2026-05-15T12:30:00.000Z",
  });
  const markdown = renderLiveInstallEvidenceReceiptMarkdown(report);
  assert.match(markdown, /Stage 6D live install evidence receipt/);
  assert.match(markdown, /Ready for live install evidence receipt: `true`/);
  assert.match(markdown, /Live install evidence accepted by this report: `false`/);
  assert.match(markdown, /Live install verified by this report: `false`/);
  assert.match(markdown, /npm run preflight:stage6c/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6D rejects incomplete evidence categories", () => {
  const manifest = readLiveInstallEvidenceManifest();
  manifest.evidenceCategories = manifest.evidenceCategories.filter((category) => category.key !== "operator_signoff");
  assert.throws(() => validateLiveInstallEvidenceManifest(manifest), Stage6DLiveInstallEvidenceError);
});

test("Stage 6D rejects receipt fields that are not redacted", () => {
  const manifest = readLiveInstallEvidenceManifest();
  manifest.receiptFields[0] = { ...manifest.receiptFields[0], redacted: false };
  assert.throws(() => validateLiveInstallEvidenceManifest(manifest), Stage6DLiveInstallEvidenceError);
});

test("Stage 6D leak scanner blocks unsafe receipt content", () => {
  assert.deepEqual(detectLiveInstallEvidenceLeaks("safe redacted evidence receipt"), []);
  assert.ok(detectLiveInstallEvidenceLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectLiveInstallEvidenceLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6D argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6DArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6DArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6D CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6d-"));
  try {
    const summary = join(dir, "receipt.md");
    const json = join(dir, "receipt.json");
    const result = runStage6DLiveInstallEvidenceReceipt({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T12:30:00.000Z",
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

test("Stage 6D CLI dry-run exits 0 and prints the receipt package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T12:30:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6D live install evidence receipt/);
  assert.match(result.stdout, /Status: `ready`/);
});

test("Stage 6D CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6d-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T12:30:00.000Z"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Status: `ready`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
