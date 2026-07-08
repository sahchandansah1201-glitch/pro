import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStage4MAdminIntegrationsBotDbSmokeSql,
  parseStage4MAdminIntegrationsBotDbSmokeArgs,
  renderStage4MAdminIntegrationsBotDbSmokePlan,
} from "./stage4m-admin-integrations-bot-db-smoke.mjs";

describe("stage4m-admin-integrations-bot-db-smoke", () => {
  it("parses verify args with compose overrides", () => {
    const parsed = parseStage4MAdminIntegrationsBotDbSmokeArgs([
      "verify",
      "--project-name",
      "dp-test",
      "--compose-env-file",
      ".env.test",
      "--compose-file",
      "a.yml",
      "--compose-file",
      "b.yml",
      "--suffix",
      "Example 123",
    ]);

    assert.equal(parsed.command, "verify");
    assert.equal(parsed.projectName, "dp-test");
    assert.equal(parsed.composeEnvFile, ".env.test");
    assert.deepEqual(parsed.composeFiles, ["a.yml", "b.yml"]);
    assert.equal(parsed.suffix, "example-123");
  });

  it("renders a transaction-safe SQL smoke with integrations and bot settings", () => {
    const sql = buildStage4MAdminIntegrationsBotDbSmokeSql({ suffix: "unit" });

    assert.match(sql, /^begin;/i);
    assert.match(sql, /insert into clinic_integrations/i);
    assert.match(sql, /from clinic_integrations/i);
    assert.match(sql, /update clinic_integrations/i);
    assert.match(sql, /insert into clinic_bot_settings/i);
    assert.match(sql, /stage4m_admin_integrations_bot_db_smoke_ok/i);
    assert.match(sql, /rollback;$/i);
    assert.doesNotMatch(sql, /accessToken|signedUrl|storagePath|credential/i);
  });

  it("documents the safety scope in dry-run output", () => {
    const plan = renderStage4MAdminIntegrationsBotDbSmokePlan({ projectName: "dp-test" });

    assert.match(plan, /integration create\/list\/update\/check/i);
    assert.match(plan, /bot settings save\/dry-run/i);
    assert.match(plan, /rolled back/i);
  });
});
