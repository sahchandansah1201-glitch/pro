import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MAssistantCaptureDbSmokeSql,
  parseStage4MAssistantCaptureDbSmokeArgs,
  renderStage4MAssistantCaptureDbSmokePlan,
  runStage4MAssistantCaptureDbSmoke,
} from "./stage4m-assistant-capture-db-smoke.mjs";

test("Stage 4M assistant capture DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MAssistantCaptureDbSmokeArgs([
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
  assert.throws(() => parseStage4MAssistantCaptureDbSmokeArgs(["bad"]), /Unknown assistant capture database smoke command/);
});

test("Stage 4M assistant capture DB smoke plan states capture checks", () => {
  const out = renderStage4MAssistantCaptureDbSmokePlan({ projectName: "prod" });

  assert.match(out, /assistant fixture/);
  assert.match(out, /asset metadata SQL/);
  assert.match(out, /rolled back/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]|objectKey|signedUrl/);
});

test("Stage 4M assistant capture DB smoke SQL exercises asset create in rollback", () => {
  const sql = buildStage4MAssistantCaptureDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /'assistant'::app_role/i);
  assert.match(sql, /insert into patients/i);
  assert.match(sql, /insert into visits/i);
  assert.match(sql, /insert into lesions/i);
  assert.match(sql, /insert into clinical_assets/i);
  assert.match(sql, /assistant capture asset create did not return dermoscopy asset/);
  assert.match(sql, /assistant capture asset create did not preserve assistant uploader/);
  assert.match(sql, /stage4m_assistant_capture_db_smoke_ok/);
});

test("Stage 4M assistant capture DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MAssistantCaptureDbSmoke(
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
        return { status: 0, stdout: "stage4m_assistant_capture_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-assistant-capture-runner-001/);
});

test("Stage 4M assistant capture DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MAssistantCaptureDbSmoke(
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
