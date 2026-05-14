import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { collectStage4SChecks } from "./check-stage4s-device-bridge-worker-contract.mjs";

test("Stage 4S guard passes for repository files", () => {
  const result = collectStage4SChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.errors.length, 0);
});

test("Stage 4S guard detects missing package scripts and forbidden runtime coupling", async () => {
  const root = await mkdtemp(join(tmpdir(), "stage4s-guard-"));
  try {
    for (const file of [
      "backend/self-hosted/device-bridge-worker-auth.mjs",
      "backend/self-hosted/device-bridge-worker-repository.mjs",
      "backend/self-hosted/device-bridge-worker-service.mjs",
      "backend/self-hosted/openapi.stage4s.json",
      "backend/self-hosted/routes.mjs",
      "deploy/self-hosted/nginx.stage4a.conf",
      "docs/backend/stage-4s-device-bridge-worker-contract.md",
      ".github/workflows/stage4s-device-bridge-worker-contract.yml",
      "scripts/preflight-all.mjs",
      "package.json",
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "supabase navigator.usb");
    }
    const result = collectStage4SChecks({ root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('"preflight:stage4s"')));
    assert.ok(result.errors.some((error) => error.includes("forbidden self-hosted boundary")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
