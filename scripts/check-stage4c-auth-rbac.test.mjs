import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { collectStage4CChecks } from "./check-stage4c-auth-rbac.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRIPT = join(__dirname, "check-stage4c-auth-rbac.mjs");

test("Stage 4C auth/RBAC guard passes in the repository", () => {
  const result = collectStage4CChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.errors.length, 0);
  assert.ok(result.checkedFiles >= 15);
});

test("Stage 4C auth/RBAC guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check-stage4c-auth-rbac.*OK/);
});
