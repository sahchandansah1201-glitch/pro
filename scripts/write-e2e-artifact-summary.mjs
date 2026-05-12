#!/usr/bin/env node
// Writes a small, sanitized markdown summary into Playwright artifacts.

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = "test-results/e2e-artifact-summary.md";
const VALID_POLICIES = new Set(["failure", "always", "never"]);
const MISSING_SIZE = "missing";

function redact(value) {
  return String(value)
    .replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/(access_token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(refresh_token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(id_token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(jwt=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(sig=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(signature=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(token=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(apikey=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(api_key=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(password=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(signed_url=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(download_url=)[^&\s)]+/gi, "$1[redacted]")
    .replace(/(storage_object_path\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(storageObjectPath\s*[:=]\s*)[^\s,;]+/g, "$1[redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(SUPABASE_ANON_KEY\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(VITE_SUPABASE_ANON_KEY\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(E2E_DOCTOR_PASSWORD\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(E2E_DOCTOR_EMAIL\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
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
  const text = value == null ? "" : redact(value).trim();
  return text === "" ? fallback : text;
}

function sizeLabel(bytes) {
  if (bytes === MISSING_SIZE) return MISSING_SIZE;
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(1)} MiB`;
}

function pathSize(absPath) {
  if (!existsSync(absPath)) return MISSING_SIZE;
  const stat = statSync(absPath);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  let total = 0;
  for (const entry of readdirSync(absPath)) {
    const childSize = pathSize(join(absPath, entry));
    if (childSize !== MISSING_SIZE) total += childSize;
  }
  return total;
}

function artifactSizeRows(paths, root) {
  return paths.map((rawPath) => {
    const safePath = rawPath.replace(/\/+$/, "");
    const size = pathSize(join(root, safePath));
    return { path: rawPath, size };
  });
}

export function buildE2eArtifactSummary(input = process.env) {
  const kind = lineValue(input.E2E_ARTIFACT_KIND ?? "e2e-artifact");
  const policy = normalizePolicy(input.E2E_ARTIFACT_POLICY ?? "failure");
  const result = lineValue(input.E2E_ARTIFACT_RESULT ?? "unknown");
  const upload = expectedUpload(policy, result);
  const paths = expectedPaths(input.E2E_ARTIFACT_EXPECTED_PATHS ?? "");
  const reportPath = lineValue(input.E2E_ARTIFACT_REPORT_PATH ?? "");
  const summaryPath = lineValue(input.E2E_ARTIFACT_SUMMARY_PATH ?? "");
  const sizeRoot = input.E2E_ARTIFACT_SIZE_ROOT || process.cwd();
  const sizeRows = artifactSizeRows(paths, sizeRoot);

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
    `- Report entry: \`${reportPath}\``,
    `- Summary file: \`${summaryPath}\``,
    `- Result: \`${result}\``,
    "",
    "### Expected artifact bundle",
  ];

  if (paths.length === 0) {
    lines.push("- `not configured`");
  } else {
    for (const path of paths) lines.push(`- \`${redact(path)}\``);
  }

  lines.push("", "### Artifact size check");
  if (sizeRows.length === 0) {
    lines.push("- `not configured`");
  } else {
    for (const row of sizeRows) {
      lines.push(`- \`${redact(row.path)}\`: ${sizeLabel(row.size)}`);
    }
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
  const summary = buildE2eArtifactSummary({
    ...process.env,
    E2E_ARTIFACT_SUMMARY_PATH: process.env.E2E_ARTIFACT_SUMMARY_PATH ?? output,
  });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, summary, "utf8");
  console.log(`[write-e2e-artifact-summary] wrote ${output}`);
}
