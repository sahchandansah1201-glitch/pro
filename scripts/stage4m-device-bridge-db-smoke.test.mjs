import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MDeviceBridgeDbSmokeSql,
  parseStage4MDeviceBridgeDbSmokeArgs,
  renderStage4MDeviceBridgeDbSmokePlan,
  runStage4MDeviceBridgeDbSmoke,
} from "./stage4m-device-bridge-db-smoke.mjs";

test("Stage 4M device bridge DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MDeviceBridgeDbSmokeArgs([
    "verify",
    "--dry-run",
    "--project-name=prod",
    "--compose-env-file",
    "deploy/self-hosted/.env.production",
    "--compose-file",
    "base.yml",
    "--compose-file",
    "prod.yml",
    "--suffix",
    "manual-001",
  ]);

  assert.equal(parsed.command, "verify");
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.projectName, "prod");
  assert.deepEqual(parsed.composeFiles, ["base.yml", "prod.yml"]);
  assert.equal(parsed.suffix, "manual-001");
  assert.throws(() => parseStage4MDeviceBridgeDbSmokeArgs(["bad"]), /Unknown device bridge database smoke command/);
});

test("Stage 4M device bridge DB smoke plan states registry, worker, and safety checks", () => {
  const out = renderStage4MDeviceBridgeDbSmokePlan({ projectName: "prod" });

  assert.match(out, /device registry, command queue, worker telemetry, recovery, and audit SQL/);
  assert.match(out, /rolled back/);
  assert.match(out, /raw command payloads/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M device bridge DB smoke SQL covers device registry and worker paths in rollback", () => {
  const sql = buildStage4MDeviceBridgeDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /insert into device_bridges/i);
  assert.match(sql, /insert into medical_devices/i);
  assert.match(sql, /insert into audit_log/i);
  assert.match(sql, /buildListDeviceBridgesSql|device bridge registry did not return the fixture bridge/);
  assert.match(sql, /device registry did not return the fixture device/);
  assert.match(sql, /device bridge command create did not return queued command/);
  assert.match(sql, /device bridge worker telemetry did not return safe summary/);
  assert.match(sql, /device bridge worker hardening did not return policy summary/);
  assert.match(sql, /device bridge worker recovery did not return actionable queue summary/);
  assert.match(sql, /device bridge worker audit did not return metadata-only summary/);
  assert.match(sql, /stage4m_device_bridge_db_smoke_ok/);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+inserted\s+as\s*\(/i);
});

test("Stage 4M device bridge DB smoke SQL uses existing repository builders", () => {
  const source = buildStage4MDeviceBridgeDbSmokeSql.toString();

  assert.match(source, /buildListDeviceBridgesSql/);
  assert.match(source, /buildListMedicalDevicesSql/);
  assert.match(source, /buildGetBridgeForCommandSql/);
  assert.match(source, /buildGetDeviceForCommandSql/);
  assert.match(source, /buildCreateDeviceBridgeCommandSql/);
  assert.match(source, /buildListWorkerTelemetrySql/);
  assert.match(source, /buildListWorkerHardeningSql/);
  assert.match(source, /buildListWorkerRecoverySql/);
  assert.match(source, /buildListWorkerCommandAuditSql/);
});

test("Stage 4M device bridge DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MDeviceBridgeDbSmoke(
    {
      command: "verify",
      projectName: "prod",
      composeEnvFile: "env",
      composeFiles: ["base.yml", "prod.yml"],
      suffix: "runner-001",
    },
    {
      spawn(cmd, args, options) {
        calls.push({ cmd, args, input: options.input });
        return { status: 0, stdout: "stage4m_device_bridge_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-device-runner-001/);
});

test("Stage 4M device bridge DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MDeviceBridgeDbSmoke(
        { command: "verify", projectName: "prod", composeEnvFile: "env", composeFiles: ["base.yml"] },
        {
          spawn() {
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
    /did not return its OK marker/,
  );
});
