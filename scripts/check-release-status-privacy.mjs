#!/usr/bin/env node
// Stage 3M · Privacy detector for release-status artifacts.
//
// Scans generated release-status markdown/json/html/history outputs for
// token-shaped values and sensitive clinical identifiers. This is a focused
// guard for release-operations artifacts, not a general source-code scanner.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_TARGETS = [
  "test-results/release-status.md",
  "test-results/release-status.json",
  "test-results/release-status.html",
  "test-results/release-history.jsonl",
];

const PATTERNS = [
  {
    label: "bearer token",
    re: /Authorization\s*[:=]\s*Bearer\s+(?!\[redacted)[A-Za-z0-9._~+/=-]{8,}/gi,
  },
  {
    label: "cookie header",
    re: /(?:Cookie|Set-Cookie)\s*:\s*(?!\s*\[redacted)[^\n\r]{6,}/gi,
  },
  {
    label: "url token parameter",
    re: /(?:access_token|refresh_token|id_token|jwt|sig|signature|token|apikey|api_key|password|signed_url|download_url)=((?!\[redacted)[^\s&"'`<>]+)/gi,
  },
  {
    label: "json token field",
    re: /"(?:access_token|refresh_token|id_token|jwt|token|apiKey|api_key|anonKey|serviceRoleKey|signedUrl|downloadUrl|password)"\s*:\s*"(?!\[redacted)[^"]{4,}"/gi,
  },
  {
    label: "email address",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    label: "patient full-name field",
    re: /patient_full_name\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi,
  },
  {
    label: "actor email field",
    re: /actor_email\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi,
  },
  {
    label: "storage object path",
    re: /storage_object_path\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi,
  },
  {
    label: "supabase key",
    re: /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{8,}\b/gi,
  },
  {
    label: "service role env",
    re: /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\[redacted)[^\s]+/gi,
  },
  {
    label: "jwt-shaped value",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
];

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function detectReleaseStatusPrivacyLeaks(content, source = "<memory>") {
  const text = String(content ?? "");
  const findings = [];
  for (const pattern of PATTERNS) {
    pattern.re.lastIndex = 0;
    let match;
    while ((match = pattern.re.exec(text)) != null) {
      findings.push({
        source,
        label: pattern.label,
        line: lineNumberAt(text, match.index),
      });
    }
  }
  return findings;
}

function main() {
  const targets = process.argv.slice(2);
  const paths = targets.length > 0 ? targets : DEFAULT_TARGETS;
  const findings = [];
  let scanned = 0;

  for (const path of paths) {
    if (!existsSync(path)) continue;
    scanned += 1;
    const content = readFileSync(path, "utf8");
    findings.push(...detectReleaseStatusPrivacyLeaks(content, path));
  }

  if (findings.length > 0) {
    console.error("[check-release-status-privacy] FAILED: possible sensitive output detected");
    for (const finding of findings) {
      console.error(`  - ${finding.source}:${finding.line} ${finding.label}`);
    }
    process.exit(1);
  }

  console.log(`[check-release-status-privacy] OK (${scanned} file(s) scanned).`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
