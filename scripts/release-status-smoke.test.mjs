import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RELEASE_STATUS = path.join(__dirname, "release-status.mjs");
const PRIVACY_CHECK = path.join(__dirname, "check-release-status-privacy.mjs");

function runNode(args, cwd = ROOT) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      RELEASE_STATUS_REPO: "sahchandansah1201-glitch/pro",
      RELEASE_STATUS_SUMMARY_PATH: "test-results/access_token=secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("release-status smoke writes markdown/json/html/history and passes privacy scan", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "release-status-smoke-"));
  const markdown = path.join(dir, "release-status.md");
  const json = path.join(dir, "release-status.json");
  const html = path.join(dir, "release-status.html");
  const history = path.join(dir, "release-history.jsonl");

  try {
    const markdownResult = runNode([
      RELEASE_STATUS,
      "--offline",
      "--output",
      markdown,
      "--history",
      history,
    ]);
    assert.equal(markdownResult.status, 0, markdownResult.stderr);
    assert.match(markdownResult.stdout, /\[release-status\] wrote/);
    assert.match(markdownResult.stdout, /\[release-status\] appended/);

    const jsonResult = runNode([
      RELEASE_STATUS,
      "--offline",
      "--json",
      "--output",
      json,
    ]);
    assert.equal(jsonResult.status, 0, jsonResult.stderr);

    const htmlResult = runNode([
      RELEASE_STATUS,
      "--offline",
      "--html",
      "--output",
      html,
    ]);
    assert.equal(htmlResult.status, 0, htmlResult.stderr);

    const markdownText = readFileSync(markdown, "utf8");
    const jsonText = readFileSync(json, "utf8");
    const htmlText = readFileSync(html, "utf8");
    const historyText = readFileSync(history, "utf8");

    assert.match(markdownText, /## Release operations dashboard/);
    assert.match(jsonText, /"title": "Release operations dashboard"/);
    assert.match(htmlText, /<!doctype html>/i);
    assert.match(historyText, /"overallStatus"/);

    for (const text of [markdownText, jsonText, htmlText, historyText]) {
      assert.doesNotMatch(text, /access_token=secret/);
      assert.doesNotMatch(text, /Bearer\s+[A-Za-z0-9]/);
      assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.-]+/);
      assert.doesNotMatch(text, /storage_object_path/);
      assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE_KEY/);
    }

    const privacyResult = runNode([
      PRIVACY_CHECK,
      markdown,
      json,
      html,
      history,
    ]);
    assert.equal(privacyResult.status, 0, privacyResult.stderr);
    assert.match(privacyResult.stdout, /\[check-release-status-privacy\] OK/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
