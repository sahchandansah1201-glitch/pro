import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MOperatorDialogDbSmokeSql,
  parseStage4MOperatorDialogDbSmokeArgs,
  renderStage4MOperatorDialogDbSmokePlan,
  runStage4MOperatorDialogDbSmoke,
} from "./stage4m-operator-dialog-db-smoke.mjs";

test("Stage 4M operator dialog DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MOperatorDialogDbSmokeArgs([
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
  assert.throws(() => parseStage4MOperatorDialogDbSmokeArgs(["bad"]), /Unknown operator dialog database smoke command/);
});

test("Stage 4M operator dialog DB smoke plan states read and note persistence checks", () => {
  const out = renderStage4MOperatorDialogDbSmokePlan({ projectName: "prod" });

  assert.match(out, /operator booking-request detail read/);
  assert.match(out, /note and status update persistence/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M operator dialog DB smoke SQL exercises detail and update in rollback", () => {
  const sql = buildStage4MOperatorDialogDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /insert into patient_portal_booking_requests/i);
  assert.match(sql, /from patient_portal_booking_requests br/i);
  assert.match(sql, /update patient_portal_booking_requests br/i);
  assert.match(sql, /br\.clinic_id in/i);
  assert.match(sql, /Stage 4M operator dialog reason test-001/);
  assert.match(sql, /Stage 4M operator dialog note test-001/);
  assert.match(sql, /operator dialog detail did not return the scoped request/);
  assert.match(sql, /operator dialog update did not persist note and status/);
  assert.match(sql, /stage4m_operator_dialog_db_smoke_ok/);
  assert.doesNotMatch(sql, /storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+(updated|scoped_requests)\s+as\s*\(/i);
});

test("Stage 4M operator dialog DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MOperatorDialogDbSmoke(
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
        return { status: 0, stdout: "stage4m_operator_dialog_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-operator-dialog-runner-001/);
});

test("Stage 4M operator dialog DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MOperatorDialogDbSmoke(
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
