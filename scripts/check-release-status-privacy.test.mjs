import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { detectReleaseStatusPrivacyLeaks } from "./check-release-status-privacy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "check-release-status-privacy.mjs");

test("detects common release-status privacy leaks", () => {
  const findings = detectReleaseStatusPrivacyLeaks(`
Authorization: Bearer abc.def.ghi123456789
Cookie: session=secret
https://example.test/file?access_token=secret&sig=also-secret
"signedUrl": "https://example.test/file?sig=secret"
patient_full_name=Jane Patient
actor_email=doctor@example.com
storage_object_path=clinic/a/visit/b/file.png
sb_publishable_abcdef123456
SUPABASE_SERVICE_ROLE_KEY=service-secret
eyJabcdefghi.eyJklmnopq.eyJrstuvwx
`, "sample.txt");

  assert.ok(findings.length >= 10);
  assert.ok(findings.some((f) => f.label === "bearer token"));
  assert.ok(findings.some((f) => f.label === "email address"));
  assert.ok(findings.some((f) => f.label === "storage object path"));
});

test("does not flag redacted release-status output", () => {
  const findings = detectReleaseStatusPrivacyLeaks(`
## Release operations dashboard
- Output is sanitized; tokens, cookies, signed URLs, emails, patient names, storage paths, and raw env values are not printed.
- Path: \`test-results/access_token=[redacted-url-param]\`
- Note: Authorization: [redacted-authorization]
- Cookie: [redacted-cookie]
- patient_full_name=[redacted-json-field]
- actor_email=[redacted-json-field]
- storage_object_path=[redacted-storage-path]
`, "release-status.md");

  assert.deepEqual(findings, []);
});

test("cli exits non-zero for unsafe files and zero for sanitized files", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "release-status-privacy-"));
  const unsafe = path.join(dir, "unsafe.md");
  const safe = path.join(dir, "safe.md");
  try {
    writeFileSync(unsafe, "access_token=secret-token\n", "utf8");
    writeFileSync(safe, "access_token=[redacted-url-param]\n", "utf8");

    const fail = spawnSync(process.execPath, [SCRIPT, unsafe], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(fail.status, 0);
    assert.match(fail.stderr, /possible sensitive output detected/);

    const pass = spawnSync(process.execPath, [SCRIPT, safe], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(pass.status, 0, pass.stderr);
    assert.match(pass.stdout, /OK/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generated markdown, json, html, and history outputs pass detector", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "release-status-generated-"));
  const md = path.join(dir, "release-status.md");
  const json = path.join(dir, "release-status.json");
  const html = path.join(dir, "release-status.html");
  const history = path.join(dir, "release-history.jsonl");
  try {
    for (const args of [
      ["--offline", "--output", md, "--history", history],
      ["--offline", "--json", "--output", json],
      ["--offline", "--html", "--output", html],
    ]) {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, "release-status.mjs"),
        ...args,
      ], {
        encoding: "utf8",
        env: {
          ...process.env,
          RELEASE_STATUS_SUMMARY_PATH: "test-results/access_token=secret",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      assert.equal(result.status, 0, result.stderr);
    }

    const detector = spawnSync(process.execPath, [SCRIPT, md, json, html, history], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(detector.status, 0, detector.stderr);
    assert.match(readFileSync(html, "utf8"), /<!doctype html>/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
