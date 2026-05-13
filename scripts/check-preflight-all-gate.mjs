#!/usr/bin/env node
// Stage 3M · Verify the all-preflight workflow keeps report and gate wiring.

import { readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/preflight-all.yml";
const content = readFileSync(WORKFLOW, "utf8");

const checks = [
  {
    label: "workflow name exists",
    ok: content.includes("name: preflight-all"),
  },
  {
    label: "script tests step exists",
    ok: content.includes("npm run test:preflight-all"),
  },
  {
    label: "workflow gate tests step exists",
    ok: content.includes("npm run test:preflight-all-gate"),
  },
  {
    label: "workflow gate checker step exists",
    ok: content.includes("npm run check:preflight-all-gate"),
  },
  {
    label: "preflight all step writes summary file",
    ok: content.includes("npm run preflight:all -- --summary test-results/preflight-all.md"),
  },
  {
    label: "architecture docs trigger preflight all",
    ok: content.includes('"docs/architecture/**"'),
  },
  {
    label: "step summary includes preflight report",
    ok: content.includes("cat test-results/preflight-all.md >> \"$GITHUB_STEP_SUMMARY\""),
  },
  {
    label: "artifact upload is configured",
    ok: content.includes("actions/upload-artifact@v4"),
  },
  {
    label: "artifact path includes preflight report",
    ok: content.includes("test-results/preflight-all.md"),
  },
  {
    label: "summary step runs always",
    ok: /- name:\s*PR preflight summary[\s\S]*?\n\s*if:\s*always\(\)/.test(content),
  },
  {
    label: "artifact upload runs always",
    ok: /- name:\s*Upload preflight report[\s\S]*?\n\s*if:\s*always\(\)/.test(content),
  },
];

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("[check-preflight-all-gate] FAILED");
  for (const check of failed) console.error(`- ${check.label}`);
  process.exit(1);
}

console.log(`[check-preflight-all-gate] OK (${checks.length} workflow gate checks)`);
