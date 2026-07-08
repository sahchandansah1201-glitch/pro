import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MPublicAnalysisDbSmokeSql,
  parseStage4MPublicAnalysisDbSmokeArgs,
  renderStage4MPublicAnalysisDbSmokePlan,
  runStage4MPublicAnalysisDbSmoke,
} from "./stage4m-public-analysis-db-smoke.mjs";

test("Stage 4M public analysis DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MPublicAnalysisDbSmokeArgs([
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
  assert.throws(() => parseStage4MPublicAnalysisDbSmokeArgs(["bad"]), /Unknown public analysis database smoke command/);
});

test("Stage 4M public analysis DB smoke plan states public link checks", () => {
  const out = renderStage4MPublicAnalysisDbSmokePlan({ projectName: "prod" });

  assert.match(out, /public analysis valid, expired, and missing link SQL/);
  assert.match(out, /rolled back/);
  assert.match(out, /no raw link tokens/i);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M public analysis DB smoke SQL exercises hashed public links in rollback", () => {
  const sql = buildStage4MPublicAnalysisDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /begin;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /insert into public_analysis_links/i);
  assert.match(sql, /from public_analysis_links pal/i);
  assert.match(sql, /reports r/i);
  assert.match(sql, /patient_safe_text/i);
  assert.match(sql, /public analysis valid link did not return patient-safe summary/);
  assert.match(sql, /public analysis expired link did not return expired status without summary/);
  assert.match(sql, /public analysis missing link did not return not_found status/);
  assert.match(sql, /stage4m_public_analysis_db_smoke_ok/);
  assert.doesNotMatch(sql, /000000000716/);
  assert.doesNotMatch(sql, /stage4m-public-valid-test-001|stage4m-public-expired-test-001|stage4m-public-missing-test-001/);
  assert.doesNotMatch(sql, /storage_path|signed_url|access_token|session_id/i);
});

test("Stage 4M public analysis DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MPublicAnalysisDbSmoke(
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
        return { status: 0, stdout: "stage4m_public_analysis_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-public-analysis-runner-001/);
});

test("Stage 4M public analysis DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MPublicAnalysisDbSmoke(
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
