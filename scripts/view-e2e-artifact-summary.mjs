#!/usr/bin/env node
// Prints a compact, sanitized CLI view of a generated e2e artifact summary.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { redact } from "./write-e2e-artifact-summary.mjs";

const DEFAULT_INPUT = "test-results/e2e-nightly-full-artifact-summary.md";

function firstMatch(content, pattern, fallback = "not set") {
  const match = content.match(pattern);
  return match?.[1]?.trim() || fallback;
}

function sectionLines(content, heading) {
  const marker = `### ${heading}`;
  const start = content.indexOf(marker);
  if (start === -1) return [];
  const rest = content.slice(start + marker.length);
  const next = rest.search(/\n###\s+/);
  const section = next === -1 ? rest : rest.slice(0, next);
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function missingSizeCount(sizeLines) {
  return sizeLines.filter((line) => /:\s+missing\s*$/i.test(line)).length;
}

export function buildE2eArtifactSummaryView(content, options = {}) {
  const source = options.source || DEFAULT_INPUT;
  const safe = redact(content);
  const title = firstMatch(safe, /^##\s+(.+)$/m, "e2e-artifact");
  const sizeLines = sectionLines(safe, "Artifact size check");
  const missing = missingSizeCount(sizeLines);

  const lines = [
    "## E2E artifact report view",
    "",
    `- Source: \`${redact(source)}\``,
    `- Kind: \`${title}\``,
    `- Result: ${firstMatch(safe, /^- Result:\s+(.+)$/m)}`,
    `- Upload expected: ${firstMatch(safe, /^- Artifact upload expected:\s+(.+)$/m)}`,
    `- Artifact name: ${firstMatch(safe, /^- Artifact name:\s+(.+)$/m)}`,
    `- Run: ${firstMatch(safe, /^- Run:\s+(.+)$/m)}`,
    `- Report entry: ${firstMatch(safe, /^- Report entry:\s+(.+)$/m)}`,
    `- Summary file: ${firstMatch(safe, /^- Summary file:\s+(.+)$/m)}`,
    `- Missing artifact paths: \`${missing}\``,
    "",
    "### Artifact size check",
  ];

  if (sizeLines.length === 0) {
    lines.push("- `not available`");
  } else {
    lines.push(...sizeLines);
  }

  lines.push(
    "",
    "### Privacy",
    "",
    "- Output is re-sanitized before display.",
    "- Do not paste raw Playwright traces or signed URLs into review comments.",
    "",
  );

  return lines.join("\n");
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = process.argv[2] || DEFAULT_INPUT;
  if (!existsSync(input)) {
    console.error(`[view-e2e-artifact-summary] missing file: ${input}`);
    process.exit(1);
  }
  const content = readFileSync(input, "utf8");
  process.stdout.write(buildE2eArtifactSummaryView(content, { source: input }));
}
