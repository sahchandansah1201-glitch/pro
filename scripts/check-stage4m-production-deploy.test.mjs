import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { collectStage4MChecks, validateLiveE2EContract } from "./check-stage4m-production-deploy.mjs";

test("Stage 4M production deployment guard passes on repository files", () => {
  const result = collectStage4MChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 23);
});

test("Stage 4M guard rejects ambiguous live e2e main locators", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-e2e-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'function appMain(page: Page) {',
      '  return page.locator("main").first();',
      '}',
      'await expect(page.locator("main")).not.toContainText(/backend/);',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /ambiguous page\.locator\("main"\)/);
});
