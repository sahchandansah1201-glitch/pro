import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MAdminServicesDbSmokeSql,
  parseStage4MAdminServicesDbSmokeArgs,
  renderStage4MAdminServicesDbSmokePlan,
  runStage4MAdminServicesDbSmoke,
} from "./stage4m-admin-services-db-smoke.mjs";

test("Stage 4M admin services DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MAdminServicesDbSmokeArgs([
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
  assert.throws(() => parseStage4MAdminServicesDbSmokeArgs(["bad"]), /Unknown admin services database smoke command/);
});

test("Stage 4M admin services DB smoke plan states the service catalog checks", () => {
  const out = renderStage4MAdminServicesDbSmokePlan({ projectName: "prod" });

  assert.match(out, /clinic service create/);
  assert.match(out, /list visibility/);
  assert.match(out, /edit persistence/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M admin services DB smoke SQL exercises create, list and edit in rollback", () => {
  const sql = buildStage4MAdminServicesDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /insert into clinic_services/i);
  assert.match(sql, /from clinic_services/i);
  assert.match(sql, /update clinic_services/i);
  assert.match(sql, /stage4m-services-test-001/);
  assert.match(sql, /admin service create did not persist the service row/);
  assert.match(sql, /admin service list did not include the created service/);
  assert.match(sql, /admin service update did not persist editable fields/);
  assert.match(sql, /stage4m_admin_services_db_smoke_ok/);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+(inserted|updated)\s+as\s*\(/i);
});

test("Stage 4M admin services DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MAdminServicesDbSmoke(
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
        return { status: 0, stdout: "stage4m_admin_services_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-services-runner-001/);
});

test("Stage 4M admin services DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MAdminServicesDbSmoke(
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
