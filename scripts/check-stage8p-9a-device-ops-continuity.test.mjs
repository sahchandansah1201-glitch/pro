#!/usr/bin/env node

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkStage8P9A } from "./check-stage8p-9a-device-ops-continuity.mjs";

test("Stage 8P-9A guard passes for repository files", () => {
  const result = checkStage8P9A();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 17);
});
