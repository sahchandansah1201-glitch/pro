import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(__dirname, "ci-release-status-sync-gate.mjs");

test("CI sync gate emits GitHub annotations only inside GitHub Actions", () => {
  const source = readFileSync(SCRIPT, "utf8");

  assert.match(source, /process\.env\.GITHUB_ACTIONS === "true"/);
  assert.match(source, /emitGithubAnnotation/);
  assert.match(source, /::\$\{type\} title=/);
  assert.match(source, /Release status gate passed/);
  assert.match(source, /Release status gate failed/);
  assert.match(source, /Release status reports may be written/);
  assert.match(source, /generated release-status reports must stay unwritten/);
});

test("CI sync gate does not emit GitHub annotations outside GitHub Actions", () => {
  const env = { ...process.env };
  delete env.GITHUB_ACTIONS;

  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[ci-release-status-sync-gate\] OK/);
  assert.doesNotMatch(result.stdout, /::notice/);
  assert.doesNotMatch(result.stdout, /::error/);
});

test("CI sync gate emits GitHub annotations when GITHUB_ACTIONS is true", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, GITHUB_ACTIONS: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::notice title=Release status gate passed::/);
  assert.match(result.stdout, /::notice title=Release status reports may be written::/);
  assert.doesNotMatch(result.stdout, /::error title=Release status gate failed::/);
  assert.match(result.stdout, /\[ci-release-status-sync-gate\] OK/);
});

test("CI sync gate keeps workflow gate before sync checker and report write checks", () => {
  const source = readFileSync(SCRIPT, "utf8");
  const workflowGateIndex = source.indexOf("check:release-status-workflow-gate");
  const syncCheckerIndex = source.indexOf("check:release-status-sync");
  const docsGuardIndex = source.indexOf("scripts/check-stage3-docs.mjs");

  assert.ok(workflowGateIndex > -1, "workflow gate command missing");
  assert.ok(syncCheckerIndex > -1, "sync checker command missing");
  assert.ok(docsGuardIndex > -1, "docs guard command missing");
  assert.ok(
    workflowGateIndex < syncCheckerIndex && syncCheckerIndex < docsGuardIndex,
    "expected workflow gate -> sync checker -> docs guard ordering",
  );
});
