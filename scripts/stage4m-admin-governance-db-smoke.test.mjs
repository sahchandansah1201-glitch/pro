import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStage4MAdminGovernanceDbSmokeSql,
  parseStage4MAdminGovernanceDbSmokeArgs,
  renderStage4MAdminGovernanceDbSmokePlan,
  runStage4MAdminGovernanceDbSmoke,
} from "./stage4m-admin-governance-db-smoke.mjs";

test("Stage 4M admin governance DB smoke parser supports verify and compose files", () => {
  const parsed = parseStage4MAdminGovernanceDbSmokeArgs([
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
  assert.throws(() => parseStage4MAdminGovernanceDbSmokeArgs(["bad"]), /Unknown admin governance database smoke command/);
});

test("Stage 4M admin governance DB smoke plan states safe governance checks", () => {
  const out = renderStage4MAdminGovernanceDbSmokePlan({ projectName: "prod" });

  assert.match(out, /admin governance aggregate read/i);
  assert.match(out, /credential-hash preparation/i);
  assert.match(out, /rolled back/i);
  assert.match(out, /no patient rows/i);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD|JWT_SECRET|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M admin governance DB smoke SQL exercises governance operations in rollback", () => {
  const sql = buildStage4MAdminGovernanceDbSmokeSql({ suffix: "test-001" });

  assert.match(sql, /^begin;/i);
  assert.match(sql, /rollback;$/i);
  assert.match(sql, /insert into patient_photo_protocol_releases/i);
  assert.match(sql, /patient_photo_protocol\.release_governance\.block_unapproved_retention/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.block_missing_expiry/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.block_unsafe_session_artifacts/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.prepare_access_artifact_rotation/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.issue_access_credential_hash/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.revoke_expired/);
  assert.match(sql, /admin governance read did not return aggregate metadata only/);
  assert.match(sql, /stage4m_admin_governance_db_smoke_ok/);
  assert.doesNotMatch(sql, /signed_url|access_token|session_id|storage_path/i);
});

test("Stage 4M admin governance DB smoke runner executes psql through docker compose", () => {
  const calls = [];
  const result = runStage4MAdminGovernanceDbSmoke(
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
        return { status: 0, stdout: "stage4m_admin_governance_db_smoke_ok\n", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "docker");
  assert.deepEqual(calls[0].args.slice(0, 7), ["compose", "--env-file", "env", "-f", "base.yml", "-f", "prod.yml"]);
  assert.ok(calls[0].args.includes("psql"));
  assert.match(calls[0].input, /stage4m-governance-runner-001/);
});

test("Stage 4M admin governance DB smoke runner fails without its OK marker", () => {
  assert.throws(
    () =>
      runStage4MAdminGovernanceDbSmoke(
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
