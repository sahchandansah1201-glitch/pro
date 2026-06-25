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

test("Stage 4M schema migration plan includes Stage 6 admin migrations and verification", () => {
  const out = renderStage4MSchemaMigrationPlan({ projectName: "prod" });
  assert.match(out, /0086_stage6_admin_management\.sql/);
  assert.match(out, /0087_stage6_clinic_address\.sql/);
  assert.match(out, /0088_stage6_admin_lifecycle\.sql/);
  assert.match(out, /private_doctor role, clinics\.address\/status\/deleted_at columns, and user_roles\.disabled_at column/);
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
            stdout: JSON.stringify({
              privateDoctorRole: true,
              clinicAddressColumn: true,
              clinicStatusColumn: true,
              clinicDeletedAtColumn: true,
              userRoleDisabledAtColumn: true,
            }),
            stderr: "",
          };
        }
        return { status: 0, stdout: "ok", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS);
  assert.equal(calls.length, 4);
  assert.ok(calls[0].input.includes("private_doctor"));
  assert.ok(calls[1].input.includes("add column if not exists address"));
  assert.ok(calls[2].input.includes("add column if not exists status"));
  assert.ok(calls[2].input.includes("add column if not exists disabled_at"));
  assert.ok(calls[3].args.includes("--command"));
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
                privateDoctorRole: true,
                clinicAddressColumn: false,
                clinicStatusColumn: true,
                clinicDeletedAtColumn: true,
                userRoleDisabledAtColumn: true,
              }),
              stderr: "",
            };
          },
        },
      ),
    /clinics\.address column/,
  );
});
