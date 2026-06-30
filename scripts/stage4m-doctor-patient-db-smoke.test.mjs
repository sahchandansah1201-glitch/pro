import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MDoctorPatientDbSmokeSql,
  parseStage4MDoctorPatientDbSmokeArgs,
  renderStage4MDoctorPatientDbSmokePlan,
  runStage4MDoctorPatientDbSmoke,
} from "./stage4m-doctor-patient-db-smoke.mjs";

test("Stage 4M doctor patient DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MDoctorPatientDbSmokeArgs([
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
  assert.throws(() => parseStage4MDoctorPatientDbSmokeArgs(["bad"]), /Unknown doctor patient database smoke command/);
});

test("Stage 4M doctor patient DB smoke plan states patient write checks", () => {
  const out = renderStage4MDoctorPatientDbSmokePlan({ projectName: "prod" });

  assert.match(out, /doctor patient create/);
  assert.match(out, /patient edit/);
  assert.match(out, /patient archive SQL/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M doctor patient DB smoke SQL exercises create, update and archive in rollback", () => {
  const sql = buildStage4MDoctorPatientDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /with inserted as \(\s*insert into patients/i);
  assert.match(sql, /with updated as \(\s*update patients p/i);
  assert.match(sql, /with archived as \(\s*update patients p/i);
  assert.match(sql, /doctor patient create did not return the created patient/);
  assert.match(sql, /doctor patient update did not return updated patient/);
  assert.match(sql, /doctor patient archive did not return archived patient/);
  assert.match(sql, /stage4m_doctor_patient_db_smoke_ok/);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+(inserted|updated|archived)\s+as\s*\(/i);
});

test("Stage 4M doctor patient DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MDoctorPatientDbSmoke(
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
        return { status: 0, stdout: "stage4m_doctor_patient_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-doctor-patient-runner-001/);
});

test("Stage 4M doctor patient DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MDoctorPatientDbSmoke(
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
