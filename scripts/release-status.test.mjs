import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  buildReleaseHistoryEntry,
  buildReleaseStatusHtml,
  buildReleaseStatusJson,
  buildReleaseStatusReport,
} from "./release-status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "release-status.mjs");

test("renders dashboard with sha, workflows, deno guard, artifact, and overall status", () => {
  const out = buildReleaseStatusReport({
    repo: "vlsmgr/dermato-pro",
    branch: "main",
    sha: "abcdef1234567890abcdef1234567890abcdef12",
    git: { dirtyCount: 1, dirtyPaths: ["package-lock.json"] },
    denoLockGuard: { ok: true, note: "no deno.lock files" },
    workflows: [
      { name: "no-deno-locks", conclusion: "success", runNumber: "42", repo: "vlsmgr/dermato-pro" },
      { name: "e2e-smoke", conclusion: "success", runNumber: "11", repo: "vlsmgr/dermato-pro" },
    ],
    artifact: {
      present: true,
      path: "test-results/e2e-nightly-full-artifact-summary.md",
      sizeLabel: "2.0 KiB",
      mtime: "2026-05-12T03:00:00.000Z",
    },
  });

  assert.match(out, /## Release operations dashboard/);
  assert.match(out, /Current SHA: `abcdef1` — https:\/\/github\.com\/vlsmgr\/dermato-pro\/commit\/abcdef123456/);
  assert.match(out, /Working tree: 1 changed file/);
  assert.match(out, /`package-lock\.json`/);
  assert.match(out, /`no-deno-locks`: success — https:\/\/github\.com\/vlsmgr\/dermato-pro\/actions\/runs\/42/);
  assert.match(out, /✓ no deno\.lock files/);
  assert.match(out, /Present: yes/);
  assert.match(out, /Status: `ok`/);
});

test("marks overall fail when any workflow failed or deno guard failed", () => {
  const fail = buildReleaseStatusReport({
    repo: "vlsmgr/dermato-pro",
    sha: "0000000000000000000000000000000000000000",
    git: { dirtyCount: 0, dirtyPaths: [] },
    denoLockGuard: { ok: true },
    workflows: [
      { name: "e2e-smoke", conclusion: "failure", runNumber: "5", repo: "vlsmgr/dermato-pro" },
    ],
    artifact: { present: false },
  });
  assert.match(fail, /Status: `fail`/);
  assert.match(fail, /✗ `e2e-smoke`: failure/);
  assert.match(fail, /Present: no/);

  const guardFail = buildReleaseStatusReport({
    repo: "vlsmgr/dermato-pro",
    sha: "abcdef1",
    git: { dirtyCount: 0, dirtyPaths: [] },
    denoLockGuard: { ok: false, note: "guard failed" },
    workflows: [{ name: "e2e-smoke", conclusion: "success", runNumber: "5" }],
    artifact: { present: false },
  });
  assert.match(guardFail, /Status: `fail`/);
  assert.match(guardFail, /✗ guard failed/);
});

test("redacts tokens, cookies, emails, patient names, signed URLs, storage paths, env values", () => {
  const out = buildReleaseStatusReport({
    repo: "vlsmgr/dermato-pro",
    sha: "abcdef1234567",
    git: {
      dirtyCount: 1,
      dirtyPaths: [
        "notes-Authorization: Bearer abc.def.ghi-actor_email=jane@example.com",
      ],
    },
    denoLockGuard: {
      ok: true,
      note: "ok ?access_token=secrettoken&signed_url=https://x/y?sig=zzz patient_full_name=John Doe storage_object_path=buckets/abc Cookie: session=xyz SUPABASE_SERVICE_ROLE_KEY=svckey sb_publishable_abcdef123",
    },
    workflows: [{ name: "e2e-smoke", conclusion: "success", runNumber: "1" }],
    artifact: {
      present: true,
      path: "test-results/e2e-nightly-full-artifact-summary.md",
      sizeLabel: "1 B",
      mtime: "2026-01-01T00:00:00.000Z",
    },
  });

  assert.doesNotMatch(out, /secrettoken/);
  assert.doesNotMatch(out, /abc\.def\.ghi/);
  assert.doesNotMatch(out, /jane@example\.com/);
  assert.doesNotMatch(out, /John Doe/);
  assert.doesNotMatch(out, /buckets\/abc/);
  assert.doesNotMatch(out, /session=xyz/);
  assert.doesNotMatch(out, /svckey/);
  assert.doesNotMatch(out, /sb_publishable_abcdef123/);
  assert.match(out, /\[redacted/);
});

test("builds sanitized json payload without leaking sensitive fields", () => {
  const payload = buildReleaseStatusJson({
    repo: "vlsmgr/dermato-pro",
    branch: "main",
    sha: "abcdef1234567890abcdef1234567890abcdef12",
    git: {
      dirtyCount: 2,
      dirtyPaths: [
        "logs/access_token=secret-token",
        "patient_full_name=Jane Patient actor_email=doctor@example.com",
      ],
    },
    denoLockGuard: {
      ok: true,
      note: "Cookie: session=secret; storage_object_path=private/file.jpg",
    },
    workflows: [
      { name: "e2e-smoke", conclusion: "success", runNumber: "77", repo: "vlsmgr/dermato-pro" },
    ],
    artifact: {
      present: true,
      path: "test-results/report?signed_url=https://x/y?sig=secret",
      sizeLabel: "1.0 KiB",
      mtime: "2026-05-12T03:00:00.000Z",
    },
  });
  const text = JSON.stringify(payload);

  assert.equal(payload.title, "Release operations dashboard");
  assert.equal(payload.currentSha.short, "abcdef1");
  assert.equal(payload.workflows[0].runLink, "https://github.com/vlsmgr/dermato-pro/actions/runs/77");
  assert.doesNotMatch(text, /secret-token/);
  assert.doesNotMatch(text, /Jane Patient/);
  assert.doesNotMatch(text, /doctor@example\.com/);
  assert.doesNotMatch(text, /private\/file\.jpg/);
  assert.doesNotMatch(text, /session=secret/);
  assert.doesNotMatch(text, /sig=secret/);
  assert.match(text, /redacted/);
});

test("builds sanitized html visual report", () => {
  const html = buildReleaseStatusHtml({
    repo: "vlsmgr/dermato-pro",
    branch: "main",
    sha: "abcdef1234567890abcdef1234567890abcdef12",
    git: {
      dirtyCount: 1,
      dirtyPaths: ["notes/<script>alert(1)</script>?access_token=secret"],
    },
    denoLockGuard: { ok: true, note: "ok Cookie: session=secret" },
    workflows: [
      { name: "e2e-smoke", conclusion: "success", runNumber: "77", repo: "vlsmgr/dermato-pro" },
    ],
    artifact: {
      present: true,
      path: "test-results/report.html?sig=secret",
      sizeLabel: "2.0 KiB",
      mtime: "2026-05-12T03:00:00.000Z",
    },
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Release operations dashboard/);
  assert.match(html, /class="status ok"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /access_token=secret/);
  assert.doesNotMatch(html, /session=secret/);
  assert.doesNotMatch(html, /sig=secret/);
});

test("builds compact release history entry", () => {
  const entry = buildReleaseHistoryEntry({
    repo: "vlsmgr/dermato-pro",
    branch: "main",
    sha: "abcdef1234567890abcdef1234567890abcdef12",
    git: { dirtyCount: 0, dirtyPaths: [] },
    denoLockGuard: { ok: true, note: "ok" },
    workflows: [
      { name: "no-deno-locks", conclusion: "success", runNumber: "42", repo: "vlsmgr/dermato-pro" },
    ],
    artifact: { present: false },
  }, new Date("2026-05-12T12:00:00.000Z"));

  assert.deepEqual(entry, {
    recordedAt: "2026-05-12T12:00:00.000Z",
    repo: "vlsmgr/dermato-pro",
    branch: "main",
    currentSha: "abcdef1",
    overallStatus: "ok",
    dirtyCount: 0,
    denoLockOk: true,
    artifactPresent: false,
    workflows: [{ name: "no-deno-locks", conclusion: "success" }],
  });
});

test("rejects unsafe repo, branch, workflow, and run-number values", () => {
  const out = buildReleaseStatusReport({
    repo: "../etc/passwd",
    branch: "main; rm -rf /",
    sha: "not-a-sha",
    git: { dirtyCount: 0, dirtyPaths: [] },
    denoLockGuard: { ok: true, note: "ok" },
    workflows: [
      { name: "evil; cat /etc/passwd", conclusion: "success", runNumber: "1" },
      { name: "e2e-smoke", conclusion: "weird-status", runNumber: "abc" },
    ],
    artifact: { present: false },
  });
  // falls back to default repo/branch and skips invalid workflow name
  assert.match(out, /Repo: `sahchandansah1201-glitch\/pro`/);
  assert.match(out, /Branch: `main`/);
  assert.match(out, /Current SHA: `unknown`/);
  assert.doesNotMatch(out, /etc\/passwd/);
  assert.doesNotMatch(out, /rm -rf/);
  assert.match(out, /`e2e-smoke`: unknown — not available/);
});

test("cli runs offline and produces a sanitized report", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--offline"], {
    encoding: "utf8",
    env: { ...process.env, RELEASE_STATUS_REPO: "vlsmgr/dermato-pro" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Release operations dashboard/);
  assert.match(result.stdout, /Latest main workflow runs/);
  assert.match(result.stdout, /Deno lock guard/);
  assert.match(result.stdout, /E2E artifact summary/);
  // No leaked secrets via env-style values.
  assert.doesNotMatch(result.stdout, /Bearer\s+[A-Za-z0-9]/);
});

test("cli writes markdown output file when --output is provided", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "release-status-"));
  const output = path.join(dir, "nested", "release-status.md");
  try {
    const result = spawnSync(process.execPath, [
      SCRIPT,
      "--offline",
      "--output",
      output,
    ], {
      encoding: "utf8",
      env: { ...process.env, RELEASE_STATUS_REPO: "vlsmgr/dermato-pro" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[release-status\] wrote/);
    const content = readFileSync(output, "utf8");
    assert.match(content, /## Release operations dashboard/);
    assert.match(content, /Status: `incomplete`/);
    assert.doesNotMatch(content, /Bearer\s+[A-Za-z0-9]/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli writes json output file when --json and --output are provided", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "release-status-json-"));
  const output = path.join(dir, "release-status.json");
  try {
    const result = spawnSync(process.execPath, [
      SCRIPT,
      "--offline",
      "--json",
      "--output",
      output,
    ], {
      encoding: "utf8",
      env: {
        ...process.env,
        RELEASE_STATUS_REPO: "vlsmgr/dermato-pro",
        RELEASE_STATUS_SUMMARY_PATH: "test-results/access_token=secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(payload.title, "Release operations dashboard");
    assert.equal(payload.artifact.present, false);
    assert.doesNotMatch(JSON.stringify(payload), /access_token=secret/);
    assert.match(JSON.stringify(payload), /redacted/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli writes html visual report and appends release history", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "release-status-html-"));
  const output = path.join(dir, "release-status.html");
  const history = path.join(dir, "release-history.jsonl");
  try {
    const result = spawnSync(process.execPath, [
      SCRIPT,
      "--offline",
      "--html",
      "--output",
      output,
      "--history",
      history,
    ], {
      encoding: "utf8",
      env: { ...process.env, RELEASE_STATUS_REPO: "vlsmgr/dermato-pro" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[release-status\] wrote/);
    assert.match(result.stdout, /\[release-status\] appended/);
    const html = readFileSync(output, "utf8");
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /Release operations dashboard/);
    const entries = readFileSync(history, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].repo, "vlsmgr/dermato-pro");
    assert.equal(entries[0].overallStatus, "incomplete");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
