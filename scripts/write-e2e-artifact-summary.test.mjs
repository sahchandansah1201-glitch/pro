import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildE2eArtifactSummary } from "./write-e2e-artifact-summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "write-e2e-artifact-summary.mjs");

test("builds a nightly artifact summary with upload expected on failure policy", () => {
  const summary = buildE2eArtifactSummary({
    E2E_ARTIFACT_KIND: "e2e-nightly-full",
    E2E_ARTIFACT_COMMAND: "npx playwright test --reporter=list,html --retries=1 --trace=retain-on-failure",
    E2E_ARTIFACT_SCHEDULE: "23 2 * * *",
    E2E_ARTIFACT_RETRIES: "1",
    E2E_ARTIFACT_POLICY: "failure",
    E2E_ARTIFACT_RESULT: "failure",
    E2E_ARTIFACT_NAME: "e2e-nightly-full-report-123",
    E2E_ARTIFACT_RUN_URL: "https://github.com/example/repo/actions/runs/123",
    E2E_ARTIFACT_EXPECTED_PATHS: [
      "playwright-report/",
      "test-results/",
      "test-results/e2e-nightly-full-vite.log",
      "test-results/e2e-nightly-full-artifact-summary.md",
    ].join("\n"),
  });

  assert.match(summary, /## e2e-nightly-full/);
  assert.match(summary, /Artifact upload expected: `yes`/);
  assert.match(summary, /`playwright-report\/`/);
  assert.match(summary, /`test-results\/e2e-nightly-full-artifact-summary\.md`/);
});

test("does not expect upload on successful default-policy runs", () => {
  const summary = buildE2eArtifactSummary({
    E2E_ARTIFACT_POLICY: "failure",
    E2E_ARTIFACT_RESULT: "success",
  });

  assert.match(summary, /Artifact upload expected: `no`/);
});

test("redacts known token-shaped values and ignores unrelated env secrets", () => {
  const secret = "super-secret-password";
  const summary = buildE2eArtifactSummary({
    E2E_ARTIFACT_COMMAND: "curl https://x.test/download?sig=abc123&access_token=tok456",
    E2E_ARTIFACT_RUN_URL: "https://github.com/example/repo/actions/runs/1?token=run-token",
    NOT_USED_SECRET: secret,
  });

  assert.doesNotMatch(summary, /abc123/);
  assert.doesNotMatch(summary, /tok456/);
  assert.doesNotMatch(summary, /run-token/);
  assert.doesNotMatch(summary, new RegExp(secret));
  assert.match(summary, /sig=\[redacted\]/);
  assert.match(summary, /access_token=\[redacted\]/);
});

test("cli writes the requested summary file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "e2e-artifact-summary-"));
  const output = path.join(dir, "summary.md");
  try {
    const result = spawnSync(process.execPath, [SCRIPT, output], {
      env: {
        ...process.env,
        E2E_ARTIFACT_KIND: "e2e-nightly-full",
        E2E_ARTIFACT_POLICY: "always",
        E2E_ARTIFACT_RESULT: "success",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    assert.equal(result.status, 0, result.stderr);
    const content = readFileSync(output, "utf8");
    assert.match(content, /## e2e-nightly-full/);
    assert.match(content, /Artifact upload expected: `yes`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
