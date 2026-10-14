import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const script of [
  "scripts/check-stage3-docs.mjs",
  "scripts/check-release-status-sync.mjs",
  "scripts/check-stage4o-self-hosted-ops-ui.mjs",
  "scripts/check-stage4e-frontend-patient-api.mjs",
]) {
  test(`${script} accepts working-only smoke without requiring a training session`, () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(), encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}

test("e2e CI runs the working-smoke regression contract and triggers on its changes", () => {
  const workflow = readFileSync(".github/workflows/e2e-smoke.yml", "utf8");
  assert.equal(workflow.split('- "scripts/working-smoke-gates.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: node --test scripts\/e2e-smoke-workflow\.test\.mjs scripts\/working-smoke-gates\.test\.mjs/);
});

test("current product roadmap references working-only evidence, not a removed mode flag", () => {
  const roadmap = readFileSync("deploy/self-hosted/product-roadmap.stage7j-7l.json", "utf8");
  assert.doesNotMatch(roadmap, /src\/lib\/app-mode\.ts/);
  assert.match(roadmap, /src\/WorkingOnlyCutover\.test\.tsx/);
  assert.doesNotMatch(roadmap, /while demo\/dev keeps mock data separated/);
});
