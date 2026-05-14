import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { collectStage4TChecks } from "./check-stage4t-device-bridge-worker-runtime.mjs";

test("Stage 4T guard passes for repository files", () => {
  const result = collectStage4TChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.errors.length, 0);
});

test("Stage 4T guard detects missing scripts and forbidden runtime coupling", async () => {
  const root = await mkdtemp(join(tmpdir(), "stage4t-guard-"));
  try {
    for (const file of [
      "worker/device-bridge/worker.mjs",
      "worker/device-bridge/worker.test.mjs",
      "worker/device-bridge/README.md",
      "deploy/self-hosted/device-bridge-worker.stage4t.env.example",
      "deploy/self-hosted/device-bridge-worker.stage4t.service",
      "docs/backend/stage-4t-device-bridge-worker-runtime.md",
      ".github/workflows/stage4t-device-bridge-worker-runtime.yml",
      "scripts/preflight-all.mjs",
      "package.json",
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "supabase navigator.usb");
    }
    const result = collectStage4TChecks({ root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('"preflight:stage4t"')));
    assert.ok(result.errors.some((error) => error.includes("forbidden self-hosted boundary")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
