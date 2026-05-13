#!/usr/bin/env node

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { collectStage4GChecks } from "./check-stage4g-self-hosted-visit-workspace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "check-stage4g-self-hosted-visit-workspace.mjs");

test("Stage 4G self-hosted visit workspace guard passes in the repository", () => {
  const result = collectStage4GChecks({ root: process.cwd() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("Stage 4G self-hosted visit workspace guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-stage4g-self-hosted-visit-workspace\] OK/);
});
