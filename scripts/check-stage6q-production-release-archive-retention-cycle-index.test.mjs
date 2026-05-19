import assert from "node:assert/strict";
import test from "node:test";

import { collectStage6QChecks } from "./check-stage6q-production-release-archive-retention-cycle-index.mjs";

test("Stage 6Q guard passes for the repository files", () => {
  const result = collectStage6QChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6Q guard reports missing files", () => {
  const result = collectStage6QChecks({ root: "/tmp/not-a-stage6q-repository" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /release-archive-retention-cycle-index\.stage6q\.json/);
});
