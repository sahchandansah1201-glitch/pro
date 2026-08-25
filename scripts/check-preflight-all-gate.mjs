#!/usr/bin/env node
// Stage 3M · Verify the all-preflight workflow keeps report and gate wiring.

import { readFileSync, readdirSync } from "node:fs";

const WORKFLOW = ".github/workflows/preflight-all.yml";
const WORKFLOWS_DIR = ".github/workflows";
const EXPECTED_NODE_VERSION = "22.22.0";
const EXPECTED_NPM_VERSION = "10.9.4";
const content = readFileSync(WORKFLOW, "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const nvmrc = readFileSync(".nvmrc", "utf8").trim();
const workflowNames = readdirSync(WORKFLOWS_DIR).filter((name) => /\.ya?ml$/.test(name));
const overlongWorkflowPaths = workflowNames.filter(
  (name) => [...`${WORKFLOWS_DIR}/${name}`].length > 255,
);
const incorrectlyPinnedWorkflows = workflowNames.filter((name) => {
  const workflow = readFileSync(`${WORKFLOWS_DIR}/${name}`, "utf8");
  if (!workflow.includes("actions/setup-node@")) return false;
  return !new RegExp(
    `^\\s*node-version:\\s*[\"']?${EXPECTED_NODE_VERSION.replaceAll(".", "\\.")}[\"']?\\s*$`,
    "m",
  ).test(workflow);
});

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
  {
    label: "package and local Node toolchain are pinned",
    ok:
      packageJson.engines?.node === EXPECTED_NODE_VERSION &&
      packageJson.packageManager === `npm@${EXPECTED_NPM_VERSION}` &&
      nvmrc === EXPECTED_NODE_VERSION,
  },
  {
    label: "workflow paths stay within GitHub's 255-character limit",
    ok: overlongWorkflowPaths.length === 0,
  },
  {
    label: "setup-node workflows pin the supported Node version",
    ok: incorrectlyPinnedWorkflows.length === 0,
  },
];

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("[check-preflight-all-gate] FAILED");
  for (const check of failed) console.error(`- ${check.label}`);
  process.exit(1);
}

console.log(`[check-preflight-all-gate] OK (${checks.length} workflow gate checks)`);
