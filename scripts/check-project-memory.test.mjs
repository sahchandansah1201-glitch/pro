#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";

import { collectProjectMemoryChecks } from "./check-project-memory.mjs";

function makeRoot() {
  const root = join(tmpdir(), `project-memory-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(root, "docs/project-memory"), { recursive: true });
  mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  for (const file of [
    "deploy/self-hosted/acceptance-baseline.stage6a.json",
    "deploy/self-hosted/server-install-package.stage6b.json",
    "deploy/self-hosted/install-verification.stage6c.json",
    "deploy/self-hosted/live-install-evidence.stage6d.json",
    "docs/backend/stage-6a-production-acceptance-baseline.md",
    "docs/backend/stage-6b-server-install-package.md",
    "docs/backend/stage-6c-production-install-verification.md",
    "docs/backend/stage-6d-live-install-evidence-receipt.md",
    ".github/workflows/stage6a-production-acceptance-baseline.yml",
    ".github/workflows/stage6b-server-install-package.yml",
    ".github/workflows/stage6c-production-install-verification.yml",
    ".github/workflows/stage6d-live-install-evidence-receipt.yml",
  ]) {
    writeFileSync(join(root, file), "ok\n");
  }
  return root;
}

function writeMemory(root, overrides = {}) {
  const memory = {
    "PROJECT_STATE.yaml": `generated_at: "2026-05-17T21:12:48+03:00"
project: "Dermatolog Pro"
repository:
  path: "${root}/pro"
  branch: "main"
  head_sha: "b2d255dcc907ea86dbb2610fccb8732849b58f02"
  head_commit: "Add Stage 6D live install evidence receipt"
  working_tree: "clean"
  upstream: "origin/main"
verification:
  deno_lock_guard:
    command: "node scripts/check-no-deno-locks.mjs"
    status: "ok"
  stage6d_preflight:
    command: "npm run preflight:stage6d"
    status: "ok"
    key_facts:
      tests_passed: 10
      guard_files_checked: 7
      leak_findings: 0
      stage6d_report_status: "ready"
      live_install_verified_by_report: false
stage_evidence:
  latest_commits:
    - "b2d255d Add Stage 6D live install evidence receipt"
  documented_stages_present:
    - "docs/backend/stage-6a-production-acceptance-baseline.md"
  workflows_present:
    - ".github/workflows/stage6a-production-acceptance-baseline.yml"
hypotheses:
  - "Next logical stage after Stage 6D is Stage 6E."
sources:
  commands:
    - "git status -sb"
  files:
    - "deploy/self-hosted/acceptance-baseline.stage6a.json"
    - "deploy/self-hosted/server-install-package.stage6b.json"
    - "deploy/self-hosted/install-verification.stage6c.json"
    - "deploy/self-hosted/live-install-evidence.stage6d.json"
`,
    "HANDOFF.md": "# HANDOFF\n\n## Confirmed state\n\nStage 6D confirmed.\n\n## Hypothesis\n\nStage 6E is likely next.\n",
    "WORKLOG.md": "# WORKLOG\n\n## 2026-05-17\n\n- Создан project-memory черный ящик.\n- Неподтвержденная история помечена как гипотеза.\n",
    "NEXT_ACTIONS.md": "# NEXT_ACTIONS\n\n## Highest-confidence next step\n\nStage 6E scaffold (hypothesis).\n",
    "RISKS.md": "# RISKS\n\n## Confirmed risks\n\nLive install evidence is external.\n\n## Hypotheses\n\nStage 6E is next.\n",
    "ARTIFACTS.md": `# ARTIFACTS

## Stage 6 manifests

- [acceptance](${join(root, "deploy/self-hosted/acceptance-baseline.stage6a.json")})

## Verification outputs

- test output captured
`,
  };
  for (const [file, content] of Object.entries({ ...memory, ...overrides })) {
    writeFileSync(join(root, "docs/project-memory", file), content);
  }
}

test("project memory guard passes for complete black-box files", () => {
  const root = makeRoot();
  writeMemory(root);
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 6);
});

test("project memory guard rejects missing required files", () => {
  const root = makeRoot();
  writeMemory(root, { "RISKS.md": "" });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /RISKS\.md/);
});

test("project memory guard requires Stage 6E uncertainty to be marked as hypothesis", () => {
  const root = makeRoot();
  writeMemory(root, { "NEXT_ACTIONS.md": "# NEXT_ACTIONS\n\nStage 6E is next.\n" });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /without marking it as a hypothesis/);
});

test("project memory guard rejects missing artifact links", () => {
  const root = makeRoot();
  writeMemory(root, {
    "ARTIFACTS.md": "# ARTIFACTS\n\n## Stage 6 manifests\n\n- [missing](/tmp/not-present-project-memory-file)\n\n## Verification outputs\n\n- output\n",
  });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing artifact/);
});
