#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHECKER = join(__dirname, "check-preflight-all-gate.mjs");
const WORKFLOW = join(ROOT, ".github/workflows/preflight-all.yml");

test("preflight-all workflow gate checker passes and reports all checks", () => {
  const result = spawnSync(process.execPath, [CHECKER], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-preflight-all-gate\] OK/);
  assert.match(result.stdout, /\(10 workflow gate checks\)/);
});

test("preflight-all workflow keeps summary and artifact report wiring", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const preflightIndex = workflow.indexOf("npm run preflight:all -- --summary test-results/preflight-all.md");
  const summaryIndex = workflow.indexOf("cat test-results/preflight-all.md >> \"$GITHUB_STEP_SUMMARY\"");
  const artifactIndex = workflow.indexOf("actions/upload-artifact@v4");

  assert.ok(preflightIndex > -1, "preflight command missing");
  assert.ok(summaryIndex > preflightIndex, "summary must be written after preflight");
  assert.ok(artifactIndex > summaryIndex, "artifact upload must follow summary step");
  assert.match(workflow, /name:\s*preflight-all/);
  assert.match(workflow, /npm run test:preflight-all/);
  assert.match(workflow, /npm run test:preflight-all-gate/);
  assert.match(workflow, /npm run check:preflight-all-gate/);
  assert.match(workflow, /if-no-files-found:\s*warn/);
});
