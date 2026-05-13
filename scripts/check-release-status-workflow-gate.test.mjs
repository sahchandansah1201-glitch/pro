import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CHECKER = path.join(__dirname, "check-release-status-workflow-gate.mjs");
const WORKFLOW = path.join(ROOT, ".github/workflows/release-status.yml");

test("workflow gate checker passes and reports all gate checks", () => {
  const result = spawnSync(process.execPath, [CHECKER], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-release-status-workflow-gate\] OK/);
  assert.match(result.stdout, /\(10 workflow gate checks\)/);
});

test("release-status workflow keeps success condition and gate-before-write ordering", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const ciGateIndex = workflow.indexOf("- name: Release-status CI sync gate");
  const writeIndex = workflow.indexOf("- name: Write release status reports");
  const writeBlock = writeIndex >= 0 ? workflow.slice(writeIndex) : "";

  assert.ok(ciGateIndex > -1, "CI sync gate step missing");
  assert.ok(writeIndex > -1, "write reports step missing");
  assert.ok(ciGateIndex < writeIndex, "CI gate must run before report writes");
  assert.match(
    writeBlock,
    /if:\s*\$\{\{\s*success\(\)\s*\}\}/,
    "report writes must stay behind the workflow success condition",
  );
  assert.match(writeBlock, /npm run release:status -- --output test-results\/release-status\.md/);
  assert.match(writeBlock, /npm run check:release-status-privacy/);
});
