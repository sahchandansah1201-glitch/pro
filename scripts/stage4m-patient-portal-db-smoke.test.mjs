import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MPatientPortalDbSmokeSql,
  parseStage4MPatientPortalDbSmokeArgs,
  renderStage4MPatientPortalDbSmokePlan,
  runStage4MPatientPortalDbSmoke,
} from "./stage4m-patient-portal-db-smoke.mjs";

test("Stage 4M patient portal DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MPatientPortalDbSmokeArgs([
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
  assert.throws(() => parseStage4MPatientPortalDbSmokeArgs(["bad"]), /Unknown patient portal database smoke command/);
});

test("Stage 4M patient portal DB smoke plan states patient portal checks", () => {
  const out = renderStage4MPatientPortalDbSmokePlan({ projectName: "prod" });

  assert.match(out, /patient portal overview/);
  assert.match(out, /booking request/);
  assert.match(out, /reminder preference SQL/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M patient portal DB smoke SQL exercises overview and writes in rollback", () => {
  const sql = buildStage4MPatientPortalDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /patient_user_links/i);
  assert.match(sql, /with portal_patient as \(/i);
  assert.match(sql, /inserted as \(\s*insert into patient_portal_booking_requests/i);
  assert.match(sql, /upserted as \(\s*insert into patient_portal_reminder_preferences/i);
  assert.match(sql, /patient portal overview did not return the linked patient/);
  assert.match(sql, /patient portal booking request did not return requested booking/);
  assert.match(sql, /patient portal reminder preferences did not return saved preferences/);
  assert.match(sql, /payload::jsonb->0->>'preferredChannel' <> 'phone'/);
  assert.match(sql, /payload::jsonb->0->>'appointmentRemindersEnabled' <> 'false'/);
  assert.match(sql, /stage4m_patient_portal_db_smoke_ok/);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+(inserted|upserted|portal_patient)\s+as\s*\(/i);
});

test("Stage 4M patient portal DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MPatientPortalDbSmoke(
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
        return { status: 0, stdout: "stage4m_patient_portal_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-patient-portal-runner-001/);
});

test("Stage 4M patient portal DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MPatientPortalDbSmoke(
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
