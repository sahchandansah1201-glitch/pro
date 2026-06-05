#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const REPORT_PATH = join(ROOT, "reports", "agent-qa", "agent-qa-eval-ledger.json");
const PROMPTFOO_RESULTS_REL = "reports/agent-qa/promptfoo-results.json";
const PROMPTFOO_RESULTS_PATH = join(ROOT, PROMPTFOO_RESULTS_REL);
const ASSERTIONS_REL = "agent-qa/promptfoo/assertions.yaml";
const OUTPUTS_REL = "agent-qa/promptfoo/model-outputs.json";
const OUTPUTS_PATH = join(ROOT, OUTPUTS_REL);

const REQUIRED_PROMPT_MARKERS = [
  "Покрытие мозгового штурма",
  "SD-MF-025",
  "SD-MF-026",
  "SD-MF-028",
  "SD-MF-046",
  "Hygiene",
  "Responsive",
];

const promptFiles = [
  "docs/prompts/dermatolog-pro-batch-bw-lovable-verification-prompt-2026-06-05.md",
].map((relativePath) => join(ROOT, relativePath));

function fail(message) {
  console.error(`[agent-qa] ${message}`);
  process.exit(1);
}

for (const file of promptFiles) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    fail(`required prompt file is missing: ${file} (${error.message})`);
  }
  for (const marker of REQUIRED_PROMPT_MARKERS) {
    if (!text.includes(marker)) {
      fail(`prompt ${file} is missing required marker: ${marker}`);
    }
  }
}

mkdirSync(dirname(PROMPTFOO_RESULTS_PATH), { recursive: true });

const promptfoo = spawnSync(
  "npx",
  [
    "promptfoo",
    "eval",
    "--assertions",
    ASSERTIONS_REL,
    "--model-outputs",
    OUTPUTS_REL,
    "--no-share",
    "--no-progress-bar",
    "--no-table",
    "--no-write",
    "--output",
    PROMPTFOO_RESULTS_REL,
  ],
  { cwd: ROOT, encoding: "utf8" },
);

if (promptfoo.stdout.trim()) process.stdout.write(promptfoo.stdout);
if (promptfoo.stderr.trim()) process.stderr.write(promptfoo.stderr);
if (promptfoo.status !== 0) {
  fail(`promptfoo assertions failed with exit code ${promptfoo.status}`);
}

const modelOutputs = JSON.parse(readFileSync(OUTPUTS_PATH, "utf8"));
const ledger = {
  generatedAt: new Date().toISOString(),
  status: "passed",
  planItem: "Agent-QA-1 executable local gates",
  providersConfigured: false,
  apiKeysRequired: false,
  gates: [
    {
      id: "promptfoo-standalone-assertions",
      status: "passed",
      assertionsPath: "agent-qa/promptfoo/assertions.yaml",
      outputsPath: "agent-qa/promptfoo/model-outputs.json",
      resultsPath: "reports/agent-qa/promptfoo-results.json",
    },
    {
      id: "lovable-prompt-marker-contract",
      status: "passed",
      promptFiles: promptFiles.map((file) => file.replace(`${ROOT}/`, "")),
      requiredMarkers: REQUIRED_PROMPT_MARKERS,
    },
  ],
  cases: modelOutputs.length,
  boundaries: {
    patientDeliveryAllowed: false,
    medicalDiagnosisClaimsAllowed: false,
    secretsAllowedInKbOrProjectMemory: false,
    fakeLovableSyncConfirmationAllowed: false,
  },
};

writeFileSync(REPORT_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`[agent-qa] passed; ledger written to ${REPORT_PATH.replace(`${ROOT}/`, "")}`);
