#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const ASSERTIONS_REL = "agent-qa/human-ui/assertions.yaml";
const OUTPUTS_REL = "agent-qa/human-ui/model-outputs.json";
const OUTPUTS_PATH = join(ROOT, OUTPUTS_REL);
const RESULTS_REL = "reports/agent-qa/human-ui-results.json";
const RESULTS_PATH = join(ROOT, RESULTS_REL);
const LEDGER_PATH = join(ROOT, "reports", "agent-qa", "human-ui-ledger.json");

const REQUIRED_CONTRACT_MARKERS = [
  "Primary task",
  "Primary CTA",
  "3-second findability",
  "Visual attention path",
  "Recovery check",
  "Responsive/accessibility",
  "Medical-safety copy",
  "Agent usage",
  "Покрытие мозгового штурма",
  "SD-MF-025",
  "SD-MF-026",
  "SD-MF-028",
  "SD-MF-046",
];

function fail(message) {
  console.error(`[human-ui-qa] ${message}`);
  process.exit(1);
}

let modelOutputs = [];
try {
  modelOutputs = JSON.parse(readFileSync(OUTPUTS_PATH, "utf8"));
} catch (error) {
  fail(`cannot read ${OUTPUTS_REL}: ${error.message}`);
}

for (const [index, item] of modelOutputs.entries()) {
  const output = String(item.output || "");
  for (const marker of REQUIRED_CONTRACT_MARKERS) {
    if (!output.includes(marker)) {
      fail(`case ${index + 1} is missing required human UI marker: ${marker}`);
    }
  }
}

mkdirSync(dirname(RESULTS_PATH), { recursive: true });

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
    RESULTS_REL,
  ],
  { cwd: ROOT, encoding: "utf8" },
);

if (promptfoo.stdout.trim()) process.stdout.write(promptfoo.stdout);
if (promptfoo.stderr.trim()) process.stderr.write(promptfoo.stderr);
if (promptfoo.status !== 0) {
  fail(`promptfoo assertions failed with exit code ${promptfoo.status}`);
}

const ledger = {
  generatedAt: new Date().toISOString(),
  status: "passed",
  planItem: "human-centered UI quality gate",
  providersConfigured: false,
  apiKeysRequired: false,
  gates: [
    {
      id: "human-ui-contract-markers",
      status: "passed",
      requiredMarkers: REQUIRED_CONTRACT_MARKERS,
    },
    {
      id: "promptfoo-human-ui-standalone-assertions",
      status: "passed",
      assertionsPath: ASSERTIONS_REL,
      outputsPath: OUTPUTS_REL,
      resultsPath: RESULTS_REL,
    },
  ],
  boundaries: {
    patientDeliveryAllowed: false,
    medicalDiagnosisClaimsAllowed: false,
    clinicalDynamicConclusionAllowed: false,
    screenshotClaimsRequireEvidence: true,
  },
};

writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`[human-ui-qa] passed; ledger written to ${LEDGER_PATH.replace(`${ROOT}/`, "")}`);
