import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    E2E_ARTIFACT_REPORT_PATH: "playwright-report/index.html",
    E2E_ARTIFACT_SUMMARY_PATH: "test-results/e2e-nightly-full-artifact-summary.md",
    E2E_ARTIFACT_EXPECTED_PATHS: [
      "playwright-report/",
      "test-results/",
      "test-results/e2e-nightly-full-vite.log",
      "test-results/e2e-nightly-full-artifact-summary.md",
    ].join("\n"),
  });

  assert.match(summary, /## e2e-nightly-full/);
  assert.match(summary, /Artifact upload expected: `yes`/);
  assert.match(summary, /Report entry: `playwright-report\/index\.html`/);
  assert.match(summary, /Summary file: `test-results\/e2e-nightly-full-artifact-summary\.md`/);
  assert.match(summary, /`playwright-report\/`/);
  assert.match(summary, /`test-results\/e2e-nightly-full-artifact-summary\.md`/);
});

test("does not expect upload on successful default-policy runs", () => {
  const summary = buildE2eArtifactSummary({
    E2E_ARTIFACT_POLICY: "failure",
    E2E_ARTIFACT_RESULT: "success",
  });

  assert.match(summary, /Artifact upload expected: `no`/);
  assert.doesNotMatch(summary, /undefined/);
});

test("redacts known token-shaped values and ignores unrelated env secrets", () => {
  const secret = "super-secret-password";
  const summary = buildE2eArtifactSummary({
    E2E_ARTIFACT_COMMAND:
      "curl -H 'Authorization: Bearer bearer-token' -H 'x-api-key: api-key-secret' https://x.test/download?sig=abc123&access_token=tok456&refresh_token=ref789&id_token=id999&jwt=jwt111&apikey=anon222&signed_url=https://signed.test",
    E2E_ARTIFACT_RUN_URL: "https://github.com/example/repo/actions/runs/1?token=run-token",
    E2E_ARTIFACT_REPORT_PATH:
      "storage_object_path:clinic/patient/file.png E2E_DOCTOR_EMAIL:doctor@example.com SUPABASE_ANON_KEY:anon-key VITE_SUPABASE_ANON_KEY:vite-key Cookie: session=abc Set-Cookie: auth=def patient_full_name:Иванова Наталья actor_email:actor@example.com",
    E2E_ARTIFACT_SUMMARY_PATH:
      '{"access_token":"json-token","signedUrl":"https://signed.test/file","storageObjectPath":"clinic/json/file.png","password":"json-pass"} sb_publishable_supersecret eyJaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.eyJbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.cccccccccccccccccc',
    NOT_USED_SECRET: secret,
  });

  assert.doesNotMatch(summary, /abc123/);
  assert.doesNotMatch(summary, /tok456/);
  assert.doesNotMatch(summary, /ref789/);
  assert.doesNotMatch(summary, /id999/);
  assert.doesNotMatch(summary, /jwt111/);
  assert.doesNotMatch(summary, /anon222/);
  assert.doesNotMatch(summary, /bearer-token/);
  assert.doesNotMatch(summary, /api-key-secret/);
  assert.doesNotMatch(summary, /doctor@example\.com/);
  assert.doesNotMatch(summary, /actor@example\.com/);
  assert.doesNotMatch(summary, /clinic\/patient\/file\.png/);
  assert.doesNotMatch(summary, /clinic\/json\/file\.png/);
  assert.doesNotMatch(summary, /anon-key/);
  assert.doesNotMatch(summary, /vite-key/);
  assert.doesNotMatch(summary, /session=abc/);
  assert.doesNotMatch(summary, /auth=def/);
  assert.doesNotMatch(summary, /Иванова Наталья/);
  assert.doesNotMatch(summary, /json-token/);
  assert.doesNotMatch(summary, /json-pass/);
  assert.doesNotMatch(summary, /sb_publishable_supersecret/);
  assert.doesNotMatch(summary, /eyJaaaaaaaa/);
  assert.doesNotMatch(summary, /run-token/);
  assert.doesNotMatch(summary, new RegExp(secret));
  assert.match(summary, /sig=\[redacted\]/);
  assert.match(summary, /access_token=\[redacted\]/);
  assert.match(summary, /Authorization: Bearer \[redacted\]/);
  assert.match(summary, /x-api-key: \[redacted\]/);
  assert.match(summary, /"\s*access_token"\s*:\s*"\[redacted\]"/);
  assert.match(summary, /\[redacted-supabase-key\]/);
  assert.match(summary, /\[redacted-jwt\]/);
});

test("includes artifact size checks for configured paths", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "e2e-artifact-size-"));
  try {
    mkdirSync(path.join(dir, "playwright-report"), { recursive: true });
    mkdirSync(path.join(dir, "test-results"), { recursive: true });
    writeFileSync(path.join(dir, "playwright-report", "index.html"), "abc", "utf8");
    writeFileSync(path.join(dir, "test-results", "trace.zip"), "12345", "utf8");

    const summary = buildE2eArtifactSummary({
      E2E_ARTIFACT_SIZE_ROOT: dir,
      E2E_ARTIFACT_EXPECTED_PATHS: [
        "playwright-report/",
        "test-results/",
        "test-results/missing.log",
      ].join("\n"),
    });

    assert.match(summary, /### Artifact size check/);
    assert.match(summary, /`playwright-report\/`: 3 B/);
    assert.match(summary, /`test-results\/`: 5 B/);
    assert.match(summary, /`test-results\/missing\.log`: missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
    assert.match(content, new RegExp(`Summary file: \`${output.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
