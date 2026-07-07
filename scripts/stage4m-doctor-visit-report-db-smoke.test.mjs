import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MDoctorVisitReportDbSmokeSql,
  parseStage4MDoctorVisitReportDbSmokeArgs,
  renderStage4MDoctorVisitReportDbSmokePlan,
  runStage4MDoctorVisitReportDbSmoke,
} from "./stage4m-doctor-visit-report-db-smoke.mjs";

test("Stage 4M doctor visit/report DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MDoctorVisitReportDbSmokeArgs([
    "verify",
    "--project-name",
    "demo",
    "--compose-env-file",
    "env",
    "--compose-file",
    "base.yml",
    "--compose-file",
    "prod.yml",
    "--suffix",
    "Smoke 01",
  ]);

  assert.equal(parsed.command, "verify");
  assert.equal(parsed.projectName, "demo");
  assert.equal(parsed.composeEnvFile, "env");
  assert.deepEqual(parsed.composeFiles, ["base.yml", "prod.yml"]);
  assert.equal(parsed.suffix, "smoke-01");
  assert.throws(() => parseStage4MDoctorVisitReportDbSmokeArgs(["bad"]), /Unknown doctor visit\/report database smoke command/);
});

test("Stage 4M doctor visit/report DB smoke plan states visit and report checks", () => {
  const out = renderStage4MDoctorVisitReportDbSmokePlan({ projectName: "demo" });

  assert.match(out, /doctor visit schedule/);
  assert.match(out, /report-package/);
  assert.match(out, /rolled back/);
});

test("Stage 4M doctor visit/report DB smoke SQL exercises visit and report read paths in rollback", () => {
  const sql = buildStage4MDoctorVisitReportDbSmokeSql({ suffix: "unit" });

  assert.match(sql, /doctor visit schedule did not return the fixture visit/);
  assert.match(sql, /doctor visit detail did not return the fixture visit/);
  assert.match(sql, /doctor visit report did not return the fixture report/);
  assert.match(sql, /doctor report package did not return report readiness/);
  assert.match(sql, /stage4m_doctor_visit_report_db_smoke_ok/);
  assert.match(sql, /rollback;/i);
});

test("Stage 4M doctor visit/report DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MDoctorVisitReportDbSmoke({
    command: "verify",
    projectName: "demo",
    composeEnvFile: "env",
    composeFiles: ["base.yml", "prod.yml"],
    suffix: "unit",
  }, {
    spawn(command, args, options) {
      calls.push({ command, args, input: options.input });
      return {
        status: 0,
        stdout: "stage4m_doctor_visit_report_db_smoke_ok",
        stderr: "",
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].command, "docker");
  assert.deepEqual(calls[0].args.slice(0, 10), [
    "compose",
    "--env-file",
    "env",
    "-f",
    "base.yml",
    "-f",
    "prod.yml",
    "-p",
    "demo",
    "exec",
  ]);
  assert.match(calls[0].input, /stage4m_doctor_visit_report_db_smoke/);
});

test("Stage 4M doctor visit/report DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () => runStage4MDoctorVisitReportDbSmoke({
      command: "verify",
      projectName: "demo",
      composeEnvFile: "env",
      composeFiles: ["base.yml"],
      suffix: "unit",
    }, {
      spawn() {
        return { status: 0, stdout: "missing", stderr: "" };
      },
    }),
    /did not return its OK marker/,
  );
});
