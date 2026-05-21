#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  buildServerOperationsHandbook,
  buildStage8J8OLovablePrompt,
  renderServerOperationsHandbookMarkdown,
} from "./stage8m-8o-server-operations-handbook.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage8m-8o-server-operations-handbook.mjs");

test("Stage 8M-8O handbook builds a ready self-hosted operations package", () => {
  const handbook = buildServerOperationsHandbook();

  assert.equal(handbook.status, "ready");
  assert.deepEqual(handbook.includedStages, [
    "Stage 8J",
    "Stage 8K",
    "Stage 8L",
    "Stage 8M",
    "Stage 8N",
    "Stage 8O",
  ]);
  assert.equal(handbook.productBoundary.managedRuntimeDependency, "none");
  assert.equal(handbook.productBoundary.managedDatabaseDependency, "none");
  assert.equal(handbook.productBoundary.workerPayloadVisibility, "backend-only");
  assert.equal(handbook.leakFindings.length, 0);
  assert.ok(handbook.requiredCommands.includes("npm run preflight:stage8j-8o"));
});

test("Stage 8M-8O markdown includes gates, boundaries and Lovable prompt", () => {
  const markdown = renderServerOperationsHandbookMarkdown();
  const prompt = buildStage8J8OLovablePrompt();

  assert.match(markdown, /Stage: `8J-8O`/);
  assert.match(markdown, /Managed runtime\/database dependency: none\/none/);
  assert.match(markdown, /npm run preflight:stage8j-8o/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
  assert.match(prompt, /Confirmed: Stage 8J-8O synced from main, no conflicts\./);
  assert.doesNotMatch(markdown, /SUPABASE_|api-read|api-write|storage_object_path|signed_url|access_token/i);
});

test("Stage 8M-8O CLI dry-run exits 0 from script-relative paths", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    cwd: "/tmp",
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Device Bridge production readiness and server operations handbook/);
  assert.match(result.stdout, /Stage 8M/);
});
