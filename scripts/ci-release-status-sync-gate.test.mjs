import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
