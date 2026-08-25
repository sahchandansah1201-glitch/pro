#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHECKER = join(__dirname, "check-preflight-all-gate.mjs");
const WORKFLOW = join(ROOT, ".github/workflows/preflight-all.yml");
const WORKFLOWS_DIR = join(ROOT, ".github/workflows");
const EXPECTED_NODE_VERSION = "22.22.0";
const EXPECTED_NPM_VERSION = "10.9.4";

test("preflight-all workflow gate checker passes and reports all checks", () => {
  const result = spawnSync(process.execPath, [CHECKER], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-preflight-all-gate\] OK/);
  assert.match(result.stdout, /\(13 workflow gate checks\)/);
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

test("CI bootstrap contract pins one supported toolchain and valid workflow paths", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const nvmrc = readFileSync(join(ROOT, ".nvmrc"), "utf8").trim();
  const workflowNames = readdirSync(WORKFLOWS_DIR).filter((name) => /\.ya?ml$/.test(name));

  assert.equal(packageJson.engines?.node, EXPECTED_NODE_VERSION);
  assert.equal(packageJson.packageManager, `npm@${EXPECTED_NPM_VERSION}`);
  assert.equal(nvmrc, EXPECTED_NODE_VERSION);

  for (const name of workflowNames) {
    const repositoryPath = `.github/workflows/${name}`;
    assert.ok(
      [...repositoryPath].length <= 255,
      `${repositoryPath} exceeds GitHub's 255-character workflow path limit`,
    );

    const workflow = readFileSync(join(WORKFLOWS_DIR, name), "utf8");
    if (!workflow.includes("actions/setup-node@")) continue;
    assert.match(
      workflow,
      new RegExp(
        `^\\s*node-version:\\s*[\"']?${EXPECTED_NODE_VERSION.replaceAll(".", "\\.")}[\"']?\\s*$`,
        "m",
      ),
      `${repositoryPath} must pin Node ${EXPECTED_NODE_VERSION}`,
    );
  }
});
