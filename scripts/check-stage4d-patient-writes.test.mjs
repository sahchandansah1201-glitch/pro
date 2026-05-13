import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { collectStage4DChecks } from "./check-stage4d-patient-writes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "check-stage4d-patient-writes.mjs");

test("Stage 4D patient writes guard passes in the repository", () => {
  const result = collectStage4DChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 6);
});

test("Stage 4D patient writes guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[check-stage4d-patient-writes\] OK/);
});
