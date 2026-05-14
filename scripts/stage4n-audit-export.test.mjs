import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  buildStage4NAuditExportPlan,
  parseStage4NAuditArgs,
  renderStage4NAuditExportPlan,
} from "./stage4n-audit-export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage4n-audit-export.mjs");

test("builds a safe audit export plan with metadata-only columns", () => {
  const plan = buildStage4NAuditExportPlan({
    projectName: "dermatolog-pro-production",
    limit: 25,
  });
  assert.equal(plan.stage, "4N");
  assert.deepEqual(plan.columns, [
    "created_at",
    "action",
    "entity_type",
    "entity_id",
    "correlation_id",
  ]);
  assert.equal(plan.command.at(-1).includes("limit 25"), true);
  const rendered = renderStage4NAuditExportPlan(plan);
  assert.match(rendered, /Stage 4N audit export dry-run/);
  assert.doesNotMatch(rendered, /patient_full_name|storage_object_path|Authorization|Bearer|DATABASE_URL|super-secret|postgres:\/\/|access_token=/i);
});

test("arg parser validates limits and project names", () => {
  assert.deepEqual(parseStage4NAuditArgs(["--dry-run", "--limit=50", "--project-name", "prod_1"]).limit, 50);
  assert.throws(() => parseStage4NAuditArgs(["--limit=0"]), /between 1 and 10000/);
  assert.throws(() => parseStage4NAuditArgs(["--project-name=bad;rm"]), /unsupported/);
});

test("cli dry-run prints safe output", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run", "--limit=10"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /limit 10/);
  assert.doesNotMatch(result.stdout, /patient_full_name|storage_object_path|Authorization|Bearer|DATABASE_URL|super-secret|postgres:\/\/|access_token=/i);
});
