import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage6BInstallPackageError,
  buildServerInstallPackage,
  detectServerInstallLeaks,
  parseStage6BArgs,
  readServerInstallManifest,
  renderServerInstallPackageMarkdown,
  runStage6BServerInstallPackage,
  validateServerInstallManifest,
} from "./stage6b-server-install-package.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage6b-server-install-package.mjs");

test("Stage 6B validates the bundled server install manifest", () => {
  const manifest = validateServerInstallManifest(readServerInstallManifest());
  assert.equal(manifest.stage, "6B");
  assert.equal(manifest.productBoundary.managedRuntimeDependency, "none");
  assert.equal(manifest.productBoundary.managedDatabaseDependency, "none");
  assert.equal(manifest.productBoundary.productRuntimeCallsExternalSystems, false);
  assert.ok(manifest.packageInputs.length >= 13);
  assert.ok(manifest.installSteps.length >= 10);
});

test("Stage 6B builds a ready server install package from accepted Stage 6A baseline", () => {
  const report = buildServerInstallPackage({
    manifest: readServerInstallManifest(),
    generatedAt: "2026-05-15T11:30:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.readyForServerInstall, true);
  assert.equal(report.checks.stage6aAccepted, true);
  assert.equal(report.checks.allRequiredInputsPresent, true);
  assert.deepEqual(report.missingRequiredInputs, []);
});

test("Stage 6B markdown summarizes inventory, steps, and privacy boundary", () => {
  const report = buildServerInstallPackage({
    manifest: readServerInstallManifest(),
    generatedAt: "2026-05-15T11:30:00.000Z",
  });
  const markdown = renderServerInstallPackageMarkdown(report);
  assert.match(markdown, /Stage 6B server install package/);
  assert.match(markdown, /Ready for server install: `true`/);
  assert.match(markdown, /Production environment template/);
  assert.match(markdown, /npm run preflight:stage6a/);
  assert.doesNotMatch(markdown, /access_token|patient_full_name|storage_object_path/i);
});

test("Stage 6B rejects incomplete package inventory", () => {
  const manifest = readServerInstallManifest();
  manifest.packageInputs = manifest.packageInputs.filter((input) => input.key !== "postgres_migrations");
  assert.throws(() => validateServerInstallManifest(manifest), Stage6BInstallPackageError);
});

test("Stage 6B leak scanner blocks unsafe install content", () => {
  assert.deepEqual(detectServerInstallLeaks("safe local install plan"), []);
  assert.ok(detectServerInstallLeaks("Authorization: Bearer abc.def.ghi").includes("bearer token"));
  assert.ok(detectServerInstallLeaks("patient_full_name").includes("patient identity"));
});

test("Stage 6B argument parser supports manifest, summary, json, now, and dry-run", () => {
  assert.deepEqual(parseStage6BArgs(["--dry-run", "--manifest", "x.json", "--summary", "x.md", "--json-out", "x.out", "--now", "2026-01-01T00:00:00.000Z"]), {
    manifest: "x.json",
    summaryPath: "x.md",
    jsonOut: "x.out",
    dryRun: true,
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.throws(() => parseStage6BArgs(["--bad"]), /Unknown argument/);
});

test("Stage 6B CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6b-"));
  try {
    const summary = join(dir, "install.md");
    const json = join(dir, "install.json");
    const result = runStage6BServerInstallPackage({
      summaryPath: summary,
      jsonOut: json,
      generatedAt: "2026-05-15T11:30:00.000Z",
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

test("Stage 6B CLI dry-run exits 0 and prints the install package", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--now", "2026-05-15T11:30:00.000Z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6B server install package/);
  assert.match(result.stdout, /Status: `ready`/);
});
