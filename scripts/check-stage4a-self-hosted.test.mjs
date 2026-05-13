#!/usr/bin/env node

import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

import { collectStage4AChecks } from "./check-stage4a-self-hosted.mjs";

test("Stage 4A self-hosted guard passes on the repository", () => {
  const result = collectStage4AChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.errors.length, 0);
  assert.ok(result.checkedFiles >= 10);
});

test("Stage 4A checker CLI exits 0 and prints OK", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-stage4a-self-hosted.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-stage4a-self-hosted\] OK/);
});
