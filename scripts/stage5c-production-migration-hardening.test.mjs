import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildStage5CMigrationInventory,
  buildStage5CPrestartSchemaSql,
  parseStage5CArgs,
  renderStage5CPlan,
  renderStage5CSeedPolicy,
} from "./stage5c-production-migration-hardening.mjs";

test("builds migration inventory with production seed policy", () => {
  const inventory = buildStage5CMigrationInventory({ root: process.cwd() });

  assert.equal(inventory.stage, "5C");
  assert.equal(inventory.managedRuntime, "none");
  assert.equal(inventory.managedDatabase, "none");
  assert.ok(inventory.migrations.length >= 13);
  assert.ok(inventory.applyInProduction.some((item) => item.file === "0001_stage4a_core.sql"));
  assert.ok(inventory.excludeFromProduction.some((item) => item.file === "0002_stage4b_runtime_seed.sql"));
  assert.ok(inventory.excludeFromProduction.some((item) => item.file === "0003_stage4c_auth_seed.sql"));
  assert.ok(inventory.excludeFromProduction.some((item) => item.file === "0007_stage4k_deploy_smoke_seed.sql"));
});

test("renders migration hardening plan and seed policy", () => {
  const inventory = buildStage5CMigrationInventory({ root: process.cwd() });
  const plan = renderStage5CPlan(inventory);
  const policy = renderStage5CSeedPolicy(inventory);

  assert.match(plan, /Stage 5C production migration and bootstrap hardening/);
  assert.match(plan, /Pre-start Database Guard/);
  assert.match(policy, /Exclude From Production/);
  assert.match(policy, /0003_stage4c_auth_seed\.sql/);
  assert.doesNotMatch(plan, /password=|Bearer\s+[A-Za-z0-9]|access_token|patient_full_name|storage_object_path|signed_url/);
});

test("builds pre-start schema SQL with audit and demo-seed checks", () => {
  const sql = buildStage5CPrestartSchemaSql(buildStage5CMigrationInventory({ root: process.cwd() }));

  assert.match(sql, /Stage 5C production pre-start schema check/);
  assert.match(sql, /audit_log_no_update/);
  assert.match(sql, /doctor\.demo@example\.invalid/);
  assert.match(sql, /no system_admin role found/);
  assert.match(sql, /'system_admin'/);
});

test("argument parser supports command outputs and rejects unknown args", () => {
  assert.deepEqual(parseStage5CArgs(["plan", "--summary", "x.md"]), {
    command: "plan",
    summaryPath: "x.md",
    outputPath: "",
  });
  assert.deepEqual(parseStage5CArgs(["schema-sql", "--output=x.sql"]), {
    command: "schema-sql",
    summaryPath: "",
    outputPath: "x.sql",
  });
  assert.throws(() => parseStage5CArgs(["bad"]), /Unknown Stage 5C command/);
  assert.throws(() => parseStage5CArgs(["plan", "--bad"]), /Unknown argument/);
});

test("cli plan, seed-policy, and schema-sql work", () => {
  const plan = spawnSync(process.execPath, ["scripts/stage5c-production-migration-hardening.mjs", "plan"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Stage 5C production migration/);

  const seedPolicy = spawnSync(process.execPath, ["scripts/stage5c-production-migration-hardening.mjs", "seed-policy"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(seedPolicy.status, 0, seedPolicy.stderr);
  assert.match(seedPolicy.stdout, /Exclude From Production/);

  const dir = mkdtempSync(join(tmpdir(), "stage5c-"));
  try {
    const output = join(dir, "schema.sql");
    const schema = spawnSync(process.execPath, [
      "scripts/stage5c-production-migration-hardening.mjs",
      "schema-sql",
      "--output",
      output,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(schema.status, 0, schema.stderr);
    assert.match(schema.stdout, /pre-start schema SQL written/);
    assert.match(readFileSync(output, "utf8"), /Stage 5C production pre-start schema check/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
