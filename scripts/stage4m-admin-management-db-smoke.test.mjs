import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MAdminDbSmokeSql,
  parseStage4MAdminDbSmokeArgs,
  renderStage4MAdminDbSmokePlan,
  runStage4MAdminManagementDbSmoke,
} from "./stage4m-admin-management-db-smoke.mjs";

test("Stage 4M admin DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MAdminDbSmokeArgs([
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
  assert.throws(() => parseStage4MAdminDbSmokeArgs(["bad"]), /Unknown admin database smoke command/);
});

test("Stage 4M admin DB smoke plan states the real create and edit checks", () => {
  const out = renderStage4MAdminDbSmokePlan({ projectName: "prod" });

  assert.match(out, /admin clinic list/);
  assert.match(out, /clinic create/);
  assert.match(out, /created row visibility/);
  assert.match(out, /clinic edit/);
  assert.match(out, /clinic empty delete/);
  assert.match(out, /analytics aggregate query/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M admin DB smoke SQL exercises list, create, edit and analytics in rollback", () => {
  const sql = buildStage4MAdminDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /insert into clinics \(name, address, slug, timezone\)/i);
  assert.match(sql, /stage4m-smoke-test-001/);
  assert.match(sql, /admin clinic list did not include the created clinic/);
  assert.match(sql, /update clinics/i);
  assert.match(sql, /admin clinic empty delete did not return deleted true/);
  assert.match(sql, /admin clinic empty delete did not hide the clinic row/);
  assert.match(sql, /admin analytics query did not return aggregate payload/);
  assert.match(sql, /stage4m_admin_management_db_smoke_ok/);
});

test("Stage 4M admin DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MAdminManagementDbSmoke(
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
        return { status: 0, stdout: "stage4m_admin_management_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-smoke-runner-001/);
});

test("Stage 4M admin DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MAdminManagementDbSmoke(
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
