import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage22A22Z } from "./check-stage22a-22z-clinical-followup-sop-policy-templates.mjs";

const ROOT = process.cwd();
const MANIFEST = "deploy/self-hosted/clinical-followup-sop-policy-templates.stage22a-22z.json";

test("Stage 22A-22Z guard passes for repository fixture", () => {
  const result = checkStage22A22Z(ROOT);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 24);
});

test("Stage 22A-22Z guard rejects managed notification dependency", () => {
  const temp = mkdtempSync(join(tmpdir(), "stage22-guard-"));
  try {
    const result = checkStage22A22Z(ROOT);
    assert.equal(result.ok, true, result.errors.join("\n"));
    const manifestPath = join(temp, MANIFEST);
    mkdirSync(join(temp, "deploy/self-hosted"), { recursive: true });
    writeFileSync(manifestPath, readFileSync(join(ROOT, MANIFEST), "utf8").replace(
      "\"managedNotificationProviderDependency\": \"none\"",
      "\"managedNotificationProviderDependency\": \"vendor email\"",
    ));
    const modified = checkStage22A22Z(temp);
    assert.equal(modified.ok, false);
    assert.match(modified.errors.join("\n"), /managed notification dependency/i);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("Stage 22A-22Z guard rejects forbidden protected markers", () => {
  const temp = mkdtempSync(join(tmpdir(), "stage22-guard-"));
  try {
    const protectedFile = "src/lib/self-hosted-follow-up-api.ts";
    mkdirSync(join(temp, "src/lib"), { recursive: true });
    writeFileSync(join(temp, protectedFile), "const leak = 'signed_url';");
    const result = checkStage22A22Z(temp);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/i);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
