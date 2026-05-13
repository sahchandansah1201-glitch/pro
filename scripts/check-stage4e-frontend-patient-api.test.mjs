#!/usr/bin/env node

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { collectStage4EChecks } from "./check-stage4e-frontend-patient-api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "check-stage4e-frontend-patient-api.mjs");

test("Stage 4E frontend patient API guard passes in the repository", () => {
  const result = collectStage4EChecks({ root: process.cwd() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("Stage 4E frontend patient API guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-stage4e-frontend-patient-api\] OK/);
});
