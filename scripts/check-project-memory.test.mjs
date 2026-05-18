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
    "deploy/self-hosted/go-live-handoff.stage6e.json",
    "deploy/self-hosted/go-live-decision-record.stage6f.json",
    "docs/backend/stage-6a-production-acceptance-baseline.md",
    "docs/backend/stage-6b-server-install-package.md",
    "docs/backend/stage-6c-production-install-verification.md",
    "docs/backend/stage-6d-live-install-evidence-receipt.md",
    "docs/backend/stage-6e-production-go-live-handoff.md",
    "docs/backend/stage-6f-production-go-live-decision-record.md",
    ".github/workflows/stage6a-production-acceptance-baseline.yml",
    ".github/workflows/stage6b-server-install-package.yml",
    ".github/workflows/stage6c-production-install-verification.yml",
    ".github/workflows/stage6d-live-install-evidence-receipt.yml",
    ".github/workflows/stage6e-production-go-live-handoff.yml",
    ".github/workflows/stage6f-production-go-live-decision-record.yml",
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
  head_sha: "ca00a2ecc354c645e2e496157437b1a636d14ad1"
  head_commit: "Refresh project memory after Stage 6E"
  working_tree: "clean"
  upstream: "origin/main"
verification:
  deno_lock_guard:
    command: "node scripts/check-no-deno-locks.mjs"
    status: "ok"
  stage6e_preflight:
    command: "npm run preflight:stage6e"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6e_report_status: "ready"
      live_server_go_live_verified_by_report: false
  stage6f_preflight:
    command: "npm run preflight:stage6f"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6f_report_status: "ready"
      final_go_live_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
stage_evidence:
  latest_commits:
    - "ca00a2e Harden Stage 6 handoff path resolution"
    - "c5417d5 Add Stage 6E production go-live handoff"
  documented_stages_present:
    - "docs/backend/stage-6e-production-go-live-handoff.md"
  workflows_present:
    - ".github/workflows/stage6e-production-go-live-handoff.yml"
hypotheses:
    - "Next logical stage after Stage 6F is Stage 6G."
sources:
  commands:
    - "git status -sb"
  files:
    - "deploy/self-hosted/acceptance-baseline.stage6a.json"
    - "deploy/self-hosted/server-install-package.stage6b.json"
    - "deploy/self-hosted/install-verification.stage6c.json"
    - "deploy/self-hosted/live-install-evidence.stage6d.json"
    - "deploy/self-hosted/go-live-handoff.stage6e.json"
    - "deploy/self-hosted/go-live-decision-record.stage6f.json"
`,
    "HANDOFF.md": "# HANDOFF\n\n## Confirmed state\n\nStage 6F confirmed.\n\n## Hypothesis\n\nStage 6G is likely next.\n",
    "WORKLOG.md": "# WORKLOG\n\n## 2026-05-17\n\n- Создан project-memory черный ящик.\n- Неподтвержденная история помечена как гипотеза.\n",
    "NEXT_ACTIONS.md": "# NEXT_ACTIONS\n\n## Highest-confidence next step\n\nStage 6G scaffold (hypothesis).\n",
    "RISKS.md": "# RISKS\n\n## Confirmed risks\n\nGo-live approval is external.\n\n## Hypotheses\n\nStage 6G is next.\n",
    "ARTIFACTS.md": `# ARTIFACTS

## Stage 6 manifests

- [acceptance](../../deploy/self-hosted/acceptance-baseline.stage6a.json)

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

test("project memory guard accepts absolute artifact links when present", () => {
  const root = makeRoot();
  writeMemory(root, {
    "ARTIFACTS.md": `# ARTIFACTS

## Stage 6 manifests

- [acceptance](${join(root, "deploy/self-hosted/acceptance-baseline.stage6a.json")})

## Verification outputs

- output
`,
  });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("project memory guard rejects missing required files", () => {
  const root = makeRoot();
  writeMemory(root, { "RISKS.md": "" });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /RISKS\.md/);
});

test("project memory guard requires Stage 6G uncertainty to be marked as hypothesis", () => {
  const root = makeRoot();
  writeMemory(root, { "NEXT_ACTIONS.md": "# NEXT_ACTIONS\n\nStage 6G is next.\n" });
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
