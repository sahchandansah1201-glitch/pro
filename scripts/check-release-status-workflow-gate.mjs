#!/usr/bin/env node
// Stage 3M · Verify release-status workflow gate ordering and report-write block.

import { readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/release-status.yml";
const SUCCESS_CONDITION = "success()";
const SUCCESS_CONDITION_PATTERN = SUCCESS_CONDITION.replace(/[()]/g, "\\$&");
const content = readFileSync(WORKFLOW, "utf8");

const checks = [
  {
    label: "preflight step exists",
    ok: content.includes("- name: Release-status local preflight"),
  },
  {
    label: "sync checker step exists",
    ok: content.includes("- name: Release-status sync checker"),
  },
  {
    label: "CI sync gate step exists",
    ok: content.includes("- name: Release-status CI sync gate"),
  },
  {
    label: "write reports step exists",
    ok: content.includes("- name: Write release status reports"),
  },
  {
    label: "write reports step uses success condition",
    ok: new RegExp(
      `- name:\\s*Write release status reports[\\s\\S]*?\\n\\s*if:\\s*\\$\\{\\{\\s*${SUCCESS_CONDITION_PATTERN}\\s*\\}\\}`,
    ).test(content),
  },
];

const gateIndex = content.indexOf("- name: Release-status CI sync gate");
const writeIndex = content.indexOf("- name: Write release status reports");
checks.push({
  label: "CI sync gate runs before report writes",
  ok: gateIndex >= 0 && writeIndex >= 0 && gateIndex < writeIndex,
});

const writeBlock = writeIndex >= 0 ? content.slice(writeIndex) : "";
for (const command of [
  "npm run release:status -- --output test-results/release-status.md --history test-results/release-history.jsonl",
  "npm run release:status:json -- --output test-results/release-status.json",
  "npm run release:status:html -- --output test-results/release-status.html",
  "npm run check:release-status-privacy",
]) {
  checks.push({
    label: `write block contains ${command}`,
    ok: writeBlock.includes(command),
  });
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("[check-release-status-workflow-gate] FAILED");
  for (const check of failed) console.error(`- ${check.label}`);
  process.exit(1);
}

console.log(
  `[check-release-status-workflow-gate] OK (${checks.length} workflow gate checks)`,
);
