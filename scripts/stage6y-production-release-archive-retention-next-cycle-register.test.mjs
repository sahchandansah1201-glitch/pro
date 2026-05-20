import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  Stage6YReleaseArchiveRetentionNextCycleRegisterError,
  buildProductionReleaseArchiveRetentionNextCycleRegister,
  detectReleaseArchiveRetentionNextCycleRegisterLeaks,
  parseStage6YArgs,
  readReleaseArchiveRetentionNextCycleRegisterManifest,
  renderProductionReleaseArchiveRetentionNextCycleRegisterMarkdown,
  runStage6YProductionReleaseArchiveRetentionNextCycleRegister,
  validateReleaseArchiveRetentionNextCycleRegisterManifest,
} from "./stage6y-production-release-archive-retention-next-cycle-register.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs");

test("Stage 6Y validates the bundled release archive retention next-cycle register manifest", () => {
  const manifest = readReleaseArchiveRetentionNextCycleRegisterManifest();
  const validated = validateReleaseArchiveRetentionNextCycleRegisterManifest(manifest);
  assert.equal(validated.stage, "6Y");
  assert.equal(validated.packageId, "stage6y-production-release-archive-retention-next-cycle-register");
  assert.equal(validated.productBoundary.managedRuntimeDependency, "none");
  assert.equal(validated.productBoundary.managedDatabaseDependency, "none");
  assert.equal(validated.productBoundary.externalArchiveRetentionNextCycleRecordsStoredOutsideGit, true);
  assert.equal(validated.productBoundary.archiveRetentionNextCycleOutcomeKnownToRepository, false);
  assert.equal(validated.registerPolicy.nextStageHypothesis, "Stage 6Z");
});

test("Stage 6Y builds a ready next-cycle register from ready Stage 6X receipt", () => {
  const report = buildProductionReleaseArchiveRetentionNextCycleRegister();
  assert.equal(report.status, "ready");
  assert.equal(report.readyForExternalReleaseArchiveRetentionNextCycleRegister, true);
  assert.equal(report.releaseArchiveRetentionNextCycleRegisterStoredInGit, true);
  assert.equal(report.externalArchiveRetentionNextCycleRecordsStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionNextCycleOwnerStoredOutsideGit, true);
  assert.equal(report.externalArchiveRetentionNextCycleDecisionStoredOutsideGit, true);
  assert.equal(report.archiveRetentionNextCycleOutcomeKnownToRepository, false);
  assert.equal(report.upstream.stage6xReady, true);
  assert.deepEqual(report.leakFindings, []);
});

test("Stage 6Y markdown summarizes register and privacy boundary", () => {
  const markdown = renderProductionReleaseArchiveRetentionNextCycleRegisterMarkdown(
    buildProductionReleaseArchiveRetentionNextCycleRegister(),
  );
  assert.match(markdown, /Stage 6Y production release archive retention next-cycle register/);
  assert.match(markdown, /Ready for external release archive retention next-cycle register: `true`/);
  assert.match(markdown, /Managed runtime\/database dependency: none\/none/);
  assert.match(markdown, /External archive retention next-cycle records stored outside git: `true`/);
  assert.match(markdown, /Archive retention next-cycle outcome known to repository: `false`/);
});

test("Stage 6Y rejects incomplete register sections", () => {
  const manifest = readReleaseArchiveRetentionNextCycleRegisterManifest();
  const broken = {
    ...manifest,
    registerSections: manifest.registerSections.slice(0, -1),
  };
  assert.throws(() => validateReleaseArchiveRetentionNextCycleRegisterManifest(broken), {
    name: "Stage6YReleaseArchiveRetentionNextCycleRegisterError",
  });
});

test("Stage 6Y rejects external register fields kept in git", () => {
  const manifest = readReleaseArchiveRetentionNextCycleRegisterManifest();
  const broken = structuredClone(manifest);
  broken.externalRegisterFields[0].storeOutsideGit = false;
  assert.throws(() => validateReleaseArchiveRetentionNextCycleRegisterManifest(broken), Stage6YReleaseArchiveRetentionNextCycleRegisterError);
});

test("Stage 6Y leak scanner blocks unsafe register content", () => {
  const findings = detectReleaseArchiveRetentionNextCycleRegisterLeaks({
    note: "Authorization: Bearer abc.def.ghi",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /bearer token/);
});

test("Stage 6Y argument parser supports manifest, summary, json, now, and dry-run", () => {
  const parsed = parseStage6YArgs([
    "--manifest",
    "custom.json",
    "--summary",
    "out.md",
    "--json-out",
    "out.json",
    "--now",
    "2026-05-19T18:00:00.000Z",
    "--dry-run",
  ]);
  assert.equal(parsed.manifest, "custom.json");
  assert.equal(parsed.summaryPath, "out.md");
  assert.equal(parsed.jsonPath, "out.json");
  assert.equal(parsed.now, "2026-05-19T18:00:00.000Z");
  assert.equal(parsed.dryRun, true);
});

test("Stage 6Y CLI writes markdown and JSON outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6y-"));
  try {
    const summaryPath = join(dir, "summary.md");
    const jsonPath = join(dir, "summary.json");
    const { report } = runStage6YProductionReleaseArchiveRetentionNextCycleRegister({
      summaryPath,
      jsonPath,
    });
    assert.equal(report.status, "ready");
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 6Y production release archive retention next-cycle register/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.readyForExternalReleaseArchiveRetentionNextCycleRegister, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6Y CLI dry-run exits 0 and prints the register", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 6Y production release archive retention next-cycle register/);
  assert.match(result.stdout, /Ready for external release archive retention next-cycle register: `true`/);
});

test("Stage 6Y CLI resolves repository inputs relative to the script location", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6y-cwd-"));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Stage 6Y production release archive retention next-cycle register/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
