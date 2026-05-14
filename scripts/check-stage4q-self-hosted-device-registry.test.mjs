import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { test } from "node:test";

import { collectStage4QChecks } from "./check-stage4q-self-hosted-device-registry.mjs";

test("Stage 4Q guard passes on repository files", () => {
  const result = collectStage4QChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 13);
});

test("Stage 4Q guard detects missing files and hardware/runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4q-guard-"));
  try {
    mkdirSync(join(root, "backend/self-hosted"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    mkdirSync(join(root, "src/pages/sys"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: {} }));
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");
    writeFileSync(join(root, "backend/self-hosted/device-registry-repository.mjs"), "supabase");
    writeFileSync(join(root, "src/pages/sys/SysDevicesPage.tsx"), "navigator.usb");
    const result = collectStage4QChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden self-hosted boundary violation/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
