import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6CInstallVerificationError,
  buildProductionInstallVerification,
  detectInstallVerificationLeaks,
  parseStage6CArgs,
  readInstallVerificationManifest,
  renderProductionInstallVerificationMarkdown,
  runStage6CProductionInstallVerification,
  validateInstallVerificationManifest,
} from "./stage6c-production-install-verification.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6c-production-install-verification.mjs");

test("Stage 6C validates the bundled production install verification manifest", () => {
  const manifest = validateInstallVerificationManifest(readInstallVerificationManifest());
  assert.equal(manifest.stage, "6C");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.liveServerEvidenceRequired, true);
  assert.ok(manifest.verificationInputs.length >= 12);
  assert.ok(manifest.verificationGates.length >= 8);
});

test("Stage 6C builds a ready verification package from ready Stage 6B install package", () => {
  const report = buildProductionInstallVerification({
    manifest: readInstallVerificationManifest(),
    generatedAt: "2026-05-15T12:00:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForLiveInstallVerification, true);
  assert.equal(report.liveInstallVerified, false);
  assert.equal(report.checks.stage6bReady, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6C markdown summarizes verification gates and live evidence policy", () => {
  const report = buildProductionInstallVerification({
    manifest: readInstallVerificationManifest(),
    generatedAt: "2026-05-15T12:00:00.000Z",
  });
  const markdown = renderProductionInstallVerificationMarkdown(report);
  assert.match(markdown, /Stage 6C production install verification/);
  assert.match(markdown, /Ready for live install verification: `true`/);
  assert.match(markdown, /Live install verified by this report: `false`/);
  assert.match(markdown, /npm run preflight:stage6b/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6C rejects incomplete verification gates", () => {
  const manifest = readInstallVerificationManifest();
  manifest.verificationGates = manifest.verificationGates.filter((gate) => gate.key !== "rollback_drill_plan");
  assert.throws(() => validateInstallVerificationManifest(manifest), Stage6CInstallVerificationError);
});

test("Stage 6C leak scanner blocks unsafe verification content", () => {
  assert.deepEqual(detectInstallVerificationLeaks("safe local verification package"), []);
  assert.ok(detectInstallVerificationLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectInstallVerificationLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6C argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6CArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6CArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6C CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6c-"));
  try {
    const summary = join(dir, "verification.md");
    const json = join(dir, "verification.json");
    const result = runStage6CProductionInstallVerification({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T12:00:00.000Z",
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

test("Stage 6C CLI dry-run exits 0 and prints the verification package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T12:00:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6C production install verification/);
  assert.match(result.stdout, /Status: `ready`/);
});
