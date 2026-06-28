import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseStage4MSchemaMigrationArgs,
  renderStage4MSchemaMigrationPlan,
  runStage4MSelfHostedSchemaMigrations,
  STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS,
} from "./stage4m-self-hosted-schema-migrations.mjs";

test("Stage 4M schema migration parser supports apply and custom compose files", () => {
  const parsed = parseStage4MSchemaMigrationArgs([
    "apply",
    "--dry-run",
    "--project-name=prod",
    "--compose-env-file",
    "deploy/self-hosted/.env.production",
    "--compose-file",
    "base.yml",
    "--compose-file",
    "prod.yml",
  ]);
  assert.equal(parsed.command, "apply");
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.projectName, "prod");
  assert.deepEqual(parsed.composeFiles, ["base.yml", "prod.yml"]);
  assert.throws(() => parseStage4MSchemaMigrationArgs(["bad"]), /Unknown schema migration command/);
});

const COMPLETE_SCHEMA = {
  privateDoctorRole: true,
  clinicAddressColumn: true,
  clinicStatusColumn: true,
  clinicDeletedAtColumn: true,
  userRoleDisabledAtColumn: true,
  serviceApiKeysTable: true,
  deviceBridgesTable: true,
  medicalDevicesTable: true,
  deviceBridgeCommandsTable: true,
  deviceBridgeWorkerColumns: true,
  deviceBridgeCommandLifecycleColumns: true,
  leadsTable: true,
  leadsRequiredColumns: true,
};

test("Stage 4M schema migration plan includes Device Bridge, leads, and Stage 6 admin migrations", () => {
  const out = renderStage4MSchemaMigrationPlan({ projectName: "prod" });
  assert.match(out, /0008_stage4q_device_registry\.sql/);
  assert.match(out, /0013_stage4x_device_bridge_audit_replay\.sql/);
  assert.match(out, /0015_stage5k_leads_appointments_contract\.sql/);
  assert.match(out, /0016_stage5l_leads_appointments_write_contract\.sql/);
  assert.match(out, /0089_stage6_device_bridge_existing_volume_repair\.sql/);
  assert.match(out, /0086_stage6_admin_management\.sql/);
  assert.match(out, /0087_stage6_clinic_address\.sql/);
  assert.match(out, /0088_stage6_admin_lifecycle\.sql/);
  assert.match(out, /0090_stage6_service_keys\.sql/);
  assert.match(out, /Device Bridge tables\/worker\/command columns/);
  assert.match(out, /leads table\/write columns/);
  assert.match(out, /service_api_keys table/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M schema migration runner applies migrations then verifies schema", () => {
  const calls = [];
  const result = runStage4MSelfHostedSchemaMigrations(
    {
      command: "apply",
      projectName: "prod",
      composeEnvFile: "env",
      composeFiles: ["base.yml", "prod.yml"],
    },
    {
      spawn(cmd, args, options) {
        calls.push({ cmd, args, input: options.input || "" });
        if (args.includes("--command")) {
          return {
            status: 0,
            stdout: JSON.stringify(COMPLETE_SCHEMA),
            stderr: "",
          };
        }
        return { status: 0, stdout: "ok", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS);
  assert.equal(calls.length, STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS.length + 1);
  assert.ok(calls[0].input.includes("create table if not exists device_bridges"));
  assert.ok(calls[3].input.includes("add column if not exists idempotency_key"));
  assert.ok(calls[5].input.includes("add column if not exists replay_policy"));
  assert.ok(calls[6].input.includes("create table if not exists leads"));
  assert.ok(calls[7].input.includes("leads_created_by_created_idx"));
  assert.ok(calls[8].input.includes("0089"));
  assert.ok(calls[8].input.includes("add column if not exists completed_at"));
  assert.ok(calls[8].input.includes("add column if not exists replay_requested_by"));
  assert.ok(calls[9].input.includes("private_doctor"));
  assert.ok(calls[10].input.includes("add column if not exists address"));
  assert.ok(calls[11].input.includes("add column if not exists status"));
  assert.ok(calls[11].input.includes("add column if not exists disabled_at"));
  assert.ok(calls[12].input.includes("create table if not exists service_api_keys"));
  assert.ok(calls.at(-1).args.includes("--command"));
  assert.ok(calls.every((call) => call.cmd === "docker"));
});

test("Stage 4M schema migration runner fails when verification reports missing address column", () => {
  assert.throws(
    () =>
      runStage4MSelfHostedSchemaMigrations(
        { command: "verify", projectName: "prod", composeEnvFile: "env", composeFiles: ["base.yml"] },
        {
          spawn() {
            return {
              status: 0,
              stdout: JSON.stringify({
                ...COMPLETE_SCHEMA,
                clinicAddressColumn: false,
              }),
              stderr: "",
            };
          },
        },
      ),
    /clinics\.address column/,
  );
});

test("Stage 4M schema migration runner fails when Device Bridge lifecycle columns are missing", () => {
  assert.throws(
    () =>
      runStage4MSelfHostedSchemaMigrations(
        { command: "verify", projectName: "prod", composeEnvFile: "env", composeFiles: ["base.yml"] },
        {
          spawn() {
            return {
              status: 0,
              stdout: JSON.stringify({
                ...COMPLETE_SCHEMA,
                deviceBridgeCommandLifecycleColumns: false,
              }),
              stderr: "",
            };
          },
        },
      ),
    /device_bridge_commands lifecycle columns/,
  );
});

test("Stage 4M schema migration runner fails when service keys table is missing", () => {
  assert.throws(
    () =>
      runStage4MSelfHostedSchemaMigrations(
        { command: "verify", projectName: "prod", composeEnvFile: "env", composeFiles: ["base.yml"] },
        {
          spawn() {
            return {
              status: 0,
              stdout: JSON.stringify({
                ...COMPLETE_SCHEMA,
                serviceApiKeysTable: false,
              }),
              stderr: "",
            };
          },
        },
      ),
    /service_api_keys table/,
  );
});

test("Stage 4M schema migration runner fails when leads write schema is missing", () => {
  assert.throws(
    () =>
      runStage4MSelfHostedSchemaMigrations(
        { command: "verify", projectName: "prod", composeEnvFile: "env", composeFiles: ["base.yml"] },
        {
          spawn() {
            return {
              status: 0,
              stdout: JSON.stringify({
                ...COMPLETE_SCHEMA,
                leadsRequiredColumns: false,
              }),
              stderr: "",
            };
          },
        },
      ),
    /leads write columns/,
  );
});
