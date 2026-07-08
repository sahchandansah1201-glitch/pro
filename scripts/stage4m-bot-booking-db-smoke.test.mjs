import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MBotBookingDbSmokeSql,
  parseStage4MBotBookingDbSmokeArgs,
  renderStage4MBotBookingDbSmokePlan,
  runStage4MBotBookingDbSmoke,
} from "./stage4m-bot-booking-db-smoke.mjs";

test("Stage 4M bot booking DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MBotBookingDbSmokeArgs([
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
  assert.throws(() => parseStage4MBotBookingDbSmokeArgs(["bad"]), /Unknown bot booking database smoke command/);
});

test("Stage 4M bot booking DB smoke plan states mini-app booking check", () => {
  const out = renderStage4MBotBookingDbSmokePlan({ projectName: "prod" });

  assert.match(out, /mini-app booking request SQL/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M bot booking DB smoke SQL writes booking request in rollback", () => {
  const sql = buildStage4MBotBookingDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /patient_user_links/i);
  assert.match(sql, /inserted as \(\s*insert into patient_portal_booking_requests/i);
  assert.match(sql, /bot mini app booking request did not return requested booking/);
  assert.match(sql, /stage4m_bot_booking_db_smoke_ok/);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+inserted\s+as\s*\(/i);
});

test("Stage 4M bot booking DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MBotBookingDbSmoke(
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
        return { status: 0, stdout: "stage4m_bot_booking_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-bot-booking-runner-001/);
});

test("Stage 4M bot booking DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MBotBookingDbSmoke(
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
