#!/usr/bin/env node

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkStage8J8O } from "./check-stage8j-8o-device-ops-hardening.mjs";

test("Stage 8J-8O guard passes for repository files", () => {
  const result = checkStage8J8O(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});
