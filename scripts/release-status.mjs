#!/usr/bin/env node
// Stage 3M · Release operations dashboard.
//
// Summarizes local git state, current SHA, latest main GitHub Actions runs,
// the deno-lock guard status, and presence of the generated e2e artifact
// summary. Output is sanitized — no tokens, cookies, signed URLs, emails,
// patient names, storage paths, or raw env values are printed.

import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { redact } from "./write-e2e-artifact-summary.mjs";

const DEFAULT_REPO = "vlsmgr/dermato-pro";
const DEFAULT_BRANCH = "main";
const DEFAULT_WORKFLOWS = [
  "no-deno-locks",
  "auth-assets-smoke-skip",
  "frontend-auth-assets",
  "e2e-smoke",
  "backend-guardrails",
];
const DEFAULT_SUMMARY_PATH = "test-results/e2e-nightly-full-artifact-summary.md";

const SHA_RE = /^[0-9a-f]{7,40}$/i;
const RUN_NUMBER_RE = /^\d+$/;

function safeText(value, fallback = "unknown") {
  if (value == null) return fallback;
  const text = redact(String(value)).trim();
  return text === "" ? fallback : text;
}

function safeSha(value, fallback = "unknown") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return SHA_RE.test(text) ? text.slice(0, 12) : fallback;
}

function safeRepo(value, fallback = DEFAULT_REPO) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(text) ? text : fallback;
}

function safeBranch(value, fallback = DEFAULT_BRANCH) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return /^[A-Za-z0-9._/-]+$/.test(text) && text.length <= 80 ? text : fallback;
}

function safeWorkflowName(value) {
  const text = String(value ?? "").trim();
  return /^[A-Za-z0-9._-]+$/.test(text) ? text : null;
}

function safeRunNumber(value) {
  const text = String(value ?? "").trim();
  return RUN_NUMBER_RE.test(text) ? text : null;
}

function safeConclusion(value) {
  const allowed = new Set([
    "success",
    "failure",
    "cancelled",
    "skipped",
    "neutral",
    "timed_out",
    "action_required",
    "stale",
    "in_progress",
    "queued",
    "unknown",
    "missing",
  ]);
  const text = String(value ?? "unknown").trim().toLowerCase();
  return allowed.has(text) ? text : "unknown";
}

function statusGlyph(conclusion) {
  if (conclusion === "success") return "✓";
  if (conclusion === "failure" || conclusion === "timed_out") return "✗";
  if (conclusion === "missing") return "·";
  return "?";
}

function safeRunLink(repo, runNumber) {
  const safeRepoName = safeRepo(repo);
  const number = safeRunNumber(runNumber);
  if (!number) return "not available";
  // Link by run number — does not expose run_id, tokens, or query params.
  return `https://github.com/${safeRepoName}/actions/runs/${number}`;
}

function safeShaLink(repo, sha) {
  const safeRepoName = safeRepo(repo);
  const safeShaText = safeSha(sha);
  if (safeShaText === "unknown") return "not available";
  return `https://github.com/${safeRepoName}/commit/${safeShaText}`;
}

function summarizeWorkflows(workflows) {
  const list = Array.isArray(workflows) ? workflows : [];
  const lines = [];
  let anyFailure = false;
  let anyMissing = false;
  for (const entry of list) {
    const name = safeWorkflowName(entry?.name);
    if (!name) continue;
    const conclusion = safeConclusion(entry?.conclusion);
    if (conclusion === "failure" || conclusion === "timed_out") anyFailure = true;
    if (conclusion === "missing" || conclusion === "unknown") anyMissing = true;
    const runLink = entry?.runNumber
      ? safeRunLink(entry?.repo, entry?.runNumber)
      : "not available";
    lines.push(
      `- ${statusGlyph(conclusion)} \`${name}\`: ${conclusion} — ${runLink}`,
    );
  }
  if (lines.length === 0) lines.push("- `not available`");
  return { lines, anyFailure, anyMissing };
}

function summarizeArtifact(artifact) {
  const present = Boolean(artifact?.present);
  const path = safeText(artifact?.path ?? DEFAULT_SUMMARY_PATH, DEFAULT_SUMMARY_PATH);
  const size = artifact?.sizeLabel ? safeText(artifact.sizeLabel) : "unknown";
  const mtime = artifact?.mtime ? safeText(artifact.mtime) : "unknown";
  return [
    `- Path: \`${path}\``,
    `- Present: ${present ? "yes" : "no"}`,
    `- Size: ${present ? size : "n/a"}`,
    `- Modified: ${present ? mtime : "n/a"}`,
  ];
}

export function buildReleaseStatusReport(input = {}) {
  const repo = safeRepo(input.repo);
  const branch = safeBranch(input.branch);
  const sha = safeSha(input.sha);
  const shortSha = sha === "unknown" ? "unknown" : sha.slice(0, 7);
  const dirtyCount = Number.isInteger(input.git?.dirtyCount) ? input.git.dirtyCount : 0;
  const dirtyPaths = Array.isArray(input.git?.dirtyPaths)
    ? input.git.dirtyPaths.slice(0, 5).map((p) => safeText(p))
    : [];
  const denoLockOk = Boolean(input.denoLockGuard?.ok);
  const denoLockNote = safeText(input.denoLockGuard?.note ?? (denoLockOk ? "no deno.lock files" : "guard failed"));
  const workflows = summarizeWorkflows(input.workflows);
  const artifactLines = summarizeArtifact(input.artifact);

  const lines = [
    "## Release operations dashboard",
    "",
    `- Repo: \`${repo}\``,
    `- Branch: \`${branch}\``,
    `- Current SHA: \`${shortSha}\` — ${safeShaLink(repo, sha)}`,
    `- Working tree: ${dirtyCount === 0 ? "clean" : `${dirtyCount} changed file(s)`}`,
  ];
  if (dirtyCount > 0 && dirtyPaths.length > 0) {
    lines.push("- Changed paths (truncated):");
    for (const p of dirtyPaths) lines.push(`  - \`${p}\``);
    if (dirtyCount > dirtyPaths.length) {
      lines.push(`  - … and ${dirtyCount - dirtyPaths.length} more`);
    }
  }
  lines.push("");

  lines.push("### Latest main workflow runs", "");
  lines.push(...workflows.lines);
  lines.push("");

  lines.push("### Deno lock guard", "");
  lines.push(`- ${denoLockOk ? "✓" : "✗"} ${denoLockNote}`);
  lines.push("");

  lines.push("### E2E artifact summary", "");
  lines.push(...artifactLines);
  lines.push("");

  const overallFail = workflows.anyFailure || !denoLockOk;
  const overallStatus = overallFail
    ? "fail"
    : workflows.anyMissing
      ? "incomplete"
      : "ok";

  lines.push("### Overall", "");
  lines.push(`- Status: \`${overallStatus}\``);
  lines.push("");

  lines.push("### Privacy", "");
  lines.push("- Output is sanitized; tokens, cookies, signed URLs, emails,");
  lines.push("  patient names, storage paths, and raw env values are not printed.");
  lines.push("");

  return redact(lines.join("\n"));
}

function readGitState() {
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  const dirtyLines = (status.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    sha: (sha.stdout || "").trim(),
    branch: (branch.stdout || "").trim(),
    dirtyCount: dirtyLines.length,
    dirtyPaths: dirtyLines.map((line) => line.replace(/^[A-Z?!]{1,2}\s+/, "")),
  };
}

function checkDenoLockGuard() {
  const result = spawnSync(process.execPath, ["scripts/check-no-deno-locks.mjs"], {
    encoding: "utf8",
  });
  if (result.status === 0) {
    return { ok: true, note: "no deno.lock files" };
  }
  return { ok: false, note: "deno.lock guard failed" };
}

function checkArtifact(path) {
  if (!existsSync(path)) {
    return { present: false, path };
  }
  const stat = statSync(path);
  const sizeLabel = stat.size < 1024
    ? `${stat.size} B`
    : `${(stat.size / 1024).toFixed(1)} KiB`;
  return {
    present: true,
    path,
    sizeLabel,
    mtime: stat.mtime.toISOString(),
  };
}

async function fetchLatestWorkflows(repo, branch, names) {
  const results = [];
  for (const name of names) {
    const safeName = safeWorkflowName(name);
    if (!safeName) continue;
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${safeName}.yml/runs?branch=${encodeURIComponent(branch)}&per_page=1`;
    let conclusion = "unknown";
    let runNumber = null;
    try {
      const resp = await fetch(url, {
        headers: { "Accept": "application/vnd.github+json" },
      });
      if (resp.status === 404) {
        conclusion = "missing";
      } else if (resp.ok) {
        const json = await resp.json();
        const run = json?.workflow_runs?.[0];
        if (run) {
          conclusion = run.conclusion || run.status || "unknown";
          runNumber = String(run.run_number ?? "");
        } else {
          conclusion = "missing";
        }
      }
    } catch {
      conclusion = "unknown";
    }
    results.push({ name: safeName, conclusion, runNumber, repo });
  }
  return results;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const offline = args.has("--offline");
  const repo = process.env.RELEASE_STATUS_REPO || DEFAULT_REPO;
  const branch = DEFAULT_BRANCH;
  const summaryPath = process.env.RELEASE_STATUS_SUMMARY_PATH || DEFAULT_SUMMARY_PATH;

  const git = readGitState();
  const denoLockGuard = checkDenoLockGuard();
  const artifact = checkArtifact(summaryPath);
  const workflows = offline
    ? DEFAULT_WORKFLOWS.map((name) => ({ name, conclusion: "unknown", repo }))
    : await fetchLatestWorkflows(repo, branch, DEFAULT_WORKFLOWS);

  const report = buildReleaseStatusReport({
    repo,
    branch,
    sha: git.sha,
    git,
    denoLockGuard,
    workflows,
    artifact,
  });

  process.stdout.write(report);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`[release-status] failed: ${err?.message || err}`);
    process.exit(1);
  });
}
