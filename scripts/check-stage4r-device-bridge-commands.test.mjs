import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { collectStage4RChecks } from "./check-stage4r-device-bridge-commands.mjs";

function write(root, file, content) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

test("Stage 4R guard passes for repository files", () => {
  const result = collectStage4RChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("Stage 4R guard detects missing files and forbidden browser hardware APIs", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4r-"));
  write(root, "package.json", JSON.stringify({ scripts: {} }));
  write(root, "scripts/preflight-all.mjs", "");
  write(root, "src/pages/sys/SysDevicesPage.tsx", "navigator.usb");

  const result = collectStage4RChecks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("Missing required file")));
  assert.ok(result.errors.some((error) => error.includes("navigator\\.usb")));
  assert.ok(result.errors.some((error) => error.includes('"preflight:stage4r"')));
});
