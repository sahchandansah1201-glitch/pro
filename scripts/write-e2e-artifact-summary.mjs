#!/usr/bin/env node
// Writes a small, sanitized markdown summary into Playwright artifacts.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = "test-results/e2e-artifact-summary.md";
const VALID_POLICIES = new Set(["failure", "always", "never"]);

function redact(value) {
  return String(value)
    .replace(/(access_token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(sig=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(password=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(E2E_DOCTOR_PASSWORD\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]");
}

function normalizePolicy(value) {
  return VALID_POLICIES.has(value) ? value : "failure";
}

function expectedUpload(policy, result) {
  if (policy === "always") return true;
  if (policy === "never") return false;
  return result !== "success";
}

function expectedPaths(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function lineValue(value, fallback = "not set") {
  const text = redact(value).trim();
  return text === "" ? fallback : text;
}

export function buildE2eArtifactSummary(input = process.env) {
  const kind = lineValue(input.E2E_ARTIFACT_KIND ?? "e2e-artifact");
  const policy = normalizePolicy(input.E2E_ARTIFACT_POLICY ?? "failure");
  const result = lineValue(input.E2E_ARTIFACT_RESULT ?? "unknown");
  const upload = expectedUpload(policy, result);
  const paths = expectedPaths(input.E2E_ARTIFACT_EXPECTED_PATHS ?? "");

  const lines = [
    `## ${kind}`,
    "",
    `- Command: \`${lineValue(input.E2E_ARTIFACT_COMMAND)}\``,
    `- Schedule: \`${lineValue(input.E2E_ARTIFACT_SCHEDULE)}\``,
    `- Retries: \`${lineValue(input.E2E_ARTIFACT_RETRIES)}\``,
    `- Artifact policy: \`${policy}\``,
    `- Artifact upload expected: \`${upload ? "yes" : "no"}\``,
    `- Artifact name: \`${lineValue(input.E2E_ARTIFACT_NAME)}\``,
    `- Run: ${lineValue(input.E2E_ARTIFACT_RUN_URL)}`,
    `- Result: \`${result}\``,
    "",
    "### Expected artifact bundle",
  ];

  if (paths.length === 0) {
    lines.push("- `not configured`");
  } else {
    for (const path of paths) lines.push(`- \`${redact(path)}\``);
  }

  lines.push(
    "",
    "### Privacy",
    "",
    "- This summary includes only explicit CI metadata.",
    "- Do not paste credentials, signed URLs, storage paths, access tokens, emails, full patient names, or service-role keys into artifact notes.",
    "",
  );

  return lines.join("\n");
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const output = process.argv[2] || DEFAULT_OUTPUT;
  const summary = buildE2eArtifactSummary();
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, summary, "utf8");
  console.log(`[write-e2e-artifact-summary] wrote ${output}`);
}
