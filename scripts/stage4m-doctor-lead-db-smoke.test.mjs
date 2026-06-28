import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MDoctorLeadDbSmokeSql,
  parseStage4MDoctorLeadDbSmokeArgs,
  renderStage4MDoctorLeadDbSmokePlan,
  runStage4MDoctorLeadDbSmoke,
} from "./stage4m-doctor-lead-db-smoke.mjs";

test("Stage 4M doctor lead DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MDoctorLeadDbSmokeArgs([
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
  assert.throws(() => parseStage4MDoctorLeadDbSmokeArgs(["bad"]), /Unknown doctor lead database smoke command/);
});

test("Stage 4M doctor lead DB smoke plan states lead write checks", () => {
  const out = renderStage4MDoctorLeadDbSmokePlan({ projectName: "prod" });

  assert.match(out, /doctor lead create/);
  assert.match(out, /lead status update/);
  assert.match(out, /lead booking SQL/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M doctor lead DB smoke SQL exercises create, update and book in rollback", () => {
  const sql = buildStage4MDoctorLeadDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /with inserted as \(\s*insert into leads/i);
  assert.match(sql, /with updated as \(\s*update leads l/i);
  assert.match(sql, /with selected_lead as \(/i);
  assert.match(sql, /insert into visits/i);
  assert.match(sql, /doctor lead create did not return the created lead/);
  assert.match(sql, /doctor lead status update did not return qualified status/);
  assert.match(sql, /doctor lead booking did not return booked lead and appointment/);
  assert.match(sql, /stage4m_doctor_lead_db_smoke_ok/);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+(inserted|updated|selected_lead)\s+as\s*\(/i);
});

test("Stage 4M doctor lead DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MDoctorLeadDbSmoke(
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
        return { status: 0, stdout: "stage4m_doctor_lead_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-doctor-lead-runner-001/);
});

test("Stage 4M doctor lead DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MDoctorLeadDbSmoke(
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
