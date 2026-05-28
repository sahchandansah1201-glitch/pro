import test from "node:test";
import assert from "node:assert/strict";

import { checkFinalBacklogTerminalCompletion } from "./check-final-backlog-terminal-completion-criterion.mjs";

test("final backlog / terminal completion criterion guard passes repository state", () => {
  const result = checkFinalBacklogTerminalCompletion(process.cwd());
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedFiles, 16);
  assert.equal(result.ok, true);
});
