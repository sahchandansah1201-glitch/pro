import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6AAcceptanceError,
  buildProductionAcceptanceBaseline,
  detectAcceptanceLeaks,
  parseStage6AArgs,
  readAcceptanceManifest,
  renderProductionAcceptanceBaselineMarkdown,
  runStage6AAcceptanceBaseline,
  validateAcceptanceManifest,
} from "./stage6a-production-acceptance-baseline.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6a-production-acceptance-baseline.mjs");

test("Stage 6A validates the bundled production acceptance manifest", () => {
  const manifest = validateAcceptanceManifest(readAcceptanceManifest());
  assert.equal(manifest.stage, "6A");
  assert.equal(manifest.productBoundary.managedRuntime, "none");
  assert.equal(manifest.productBoundary.managedDatabase, "none");
  assert.equal(manifest.productBoundary.demoFallbackInProduction, false);
  assert.ok(manifest.acceptanceDomains.length >= 11);
});

test("Stage 6A builds an accepted baseline from repository evidence", () => {
  const report = buildProductionAcceptanceBaseline({
    manifest: readAcceptanceManifest(),
    generatedAt: "2026-05-15T11:00:00.000Z",
  });
  assert.equal(report.status, "accepted");
  assert.equal(report.readyForServerInstallPackage, true);
  assert.equal(report.checks.packageLockUnchanged, true);
  assert.equal(report.checks.noDenoLockFiles, true);
  assert.deepEqual(report.failedDomains, []);
});

test("Stage 6A markdown report summarizes domains and privacy boundary", () => {
  const report = buildProductionAcceptanceBaseline({
    manifest: readAcceptanceManifest(),
    generatedAt: "2026-05-15T11:00:00.000Z",
  });
  const markdown = renderProductionAcceptanceBaselineMarkdown(report);
  assert.match(markdown, /Stage 6A production acceptance baseline/);
  assert.match(markdown, /Ready for Stage 6B server install package: `true`/);
  assert.match(markdown, /Deployable self-hosted stack/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6A rejects incomplete acceptance domains", () => {
  const manifest = readAcceptanceManifest();
  manifest.acceptanceDomains = manifest.acceptanceDomains.filter((domain) => domain.key !== "device_bridge");
  assert.throws(() => validateAcceptanceManifest(manifest), Stage6AAcceptanceError);
});

test("Stage 6A leak scanner blocks unsafe report content", () => {
  assert.deepEqual(detectAcceptanceLeaks("safe local evidence"), []);
  assert.ok(detectAcceptanceLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectAcceptanceLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6A argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6AArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6AArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6A CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6a-"));
  try {
    const summary = join(dir, "acceptance.md");
    const json = join(dir, "acceptance.json");
    const result = runStage6AAcceptanceBaseline({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T11:00:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.equal(existsSync(summary), true);
    assert.equal(existsSync(json), true);
    assert.match(readFileSync(summary, "utf8"), /Status: `accepted`/);
    assert.equal(JSON.parse(readFileSync(json, "utf8")).status, "accepted");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6A CLI dry-run exits 0 and prints the report", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T11:00:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6A production acceptance baseline/);
  assert.match(result.stdout, /Status: `accepted`/);
});
