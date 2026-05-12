#!/usr/bin/env node
// Deterministic heading and local-link guard for Stage 3 release docs.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const ROOT = process.cwd();
const DOC_ROOT = "docs/frontend";

const EXPECTED = [
  {
    file: "stage-3a-deployment-runbook.md",
    headings: [
      "# Stage 3A — Deployment runbook for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Pre-deploy gates",
      "## 3. Required frontend env vars",
      "## 4. Optional local real-auth smoke",
      "## 5. Deploy verification",
      "## 6. Rollback notes",
      "## 7. Known non-blocking warnings",
      "## 8. Release owner checklist",
    ],
  },
  {
    file: "stage-3b-rollback-drill.md",
    headings: [
      "# Stage 3B — Rollback drill checklist for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Drill prerequisites",
      "## 3. Failure triggers",
      "## 4. Rollback steps",
      "## 5. Post-rollback checks",
      "## 6. When not to rollback code",
      "## 7. Drill completion criteria",
    ],
  },
  {
    file: "stage-3c-production-smoke.md",
    headings: [
      "# Stage 3C — Production smoke checklist for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Preconditions",
      "## 3. Smoke path",
      "## 4. Optional real-auth smoke command",
      "## 5. Pass criteria",
      "## 6. Fail criteria and next step",
      "## 7. Fast e2e smoke vs full e2e",
      "## 8. CI fast smoke workflow",
      "## 9. Nightly full e2e",
      "## 10. Nightly artifacts report",
    ],
  },
  {
    file: "stage-3d-incident-response.md",
    headings: [
      "# Stage 3D — Production incident response for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Severity triggers",
      "## 3. First response",
      "## 4. Decision tree",
      "## 5. Verification after mitigation",
      "## 6. Escalation contacts placeholders",
      "## 7. Incident closure",
    ],
  },
  {
    file: "stage-3e-release-decision-record.md",
    headings: [
      "# Stage 3E — Release decision record for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Release decision",
      "## 3. Required evidence",
      "## 4. Go criteria",
      "## 5. No-go criteria",
      "## 6. Decision owner placeholders",
      "## 7. Post-release follow-up",
    ],
  },
  {
    file: "stage-3f-release-audit-index.md",
    headings: [
      "# Stage 3F — Release audit index for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Stage document map",
      "## 3. Evidence commands",
      "## 4. Release invariants",
      "## 5. Reviewer checklist",
      "## 6. Audit outcome",
    ],
  },
  {
    file: "stage-3g-final-handoff-summary.md",
    headings: [
      "# Stage 3G — Final handoff summary for auth/assets readiness",
      "## 1. Scope",
      "## 2. Operational docs",
      "## 3. Verification commands",
      "## 4. Expected repository state",
      "## 5. Out of scope",
      "## 6. Handoff checklist",
      "## 7. Next-stage rule",
    ],
  },
  {
    file: "stage-3h-release-reviewer-faq.md",
    headings: [
      "# Stage 3H — Release reviewer FAQ for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Common questions",
      "## 3. Evidence commands",
      "## 4. Known expected repository state",
      "## 5. Escalation",
    ],
  },
  {
    file: "stage-3i-final-documentation-index.md",
    headings: [
      "# Stage 3I — Final documentation index for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Full documentation map",
      "## 3. Verification map",
      "## 4. Release-readiness status",
      "## 5. Maintenance rule",
      "## 6. GitHub to Lovable sync pilot",
      "## 7. Pilot result",
      "## 8. Documentation section checklist",
      "## 9. Sync changelog",
    ],
  },
  {
    file: "stage-3j-github-lovable-working-mode.md",
    headings: [
      "# Stage 3J — GitHub-first working mode for Lovable sync",
      "## 1. Purpose",
      "## 2. Responsibilities",
      "## 3. Standard Codex flow",
      "## 4. Lovable confirmation prompt shape",
      "## 5. Token reduction rules",
      "## 6. Failure handling",
      "## 7. Acceptance criteria",
    ],
  },
  {
    file: "stage-3k-lovable-suggestions-backlog.md",
    headings: [
      "# Stage 3K — Lovable suggestions backlog",
      "## 1. Purpose",
      "## 2. Triage states",
      "## 3. Decision rules",
      "## 4. Current backlog",
      "## 5. Per-cycle update rule",
      "## 6. Lovable confirm prompt note",
      "## 7. Triage checklist template",
      "## 8. UX review: patient create-delete triage",
    ],
  },
  {
    file: "stage-3l-nightly-artifacts-report.md",
    headings: [
      "# Stage 3L — Nightly artifacts report for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Source workflow",
      "## 3. Artifact policy",
      "## 4. Expected artifact bundle",
      "## 5. Report fields",
      "## 6. Failure investigation",
      "## 7. Retention and privacy",
    ],
  },
];

const EXTRA_REQUIRED_REFS = [
  "stage-3a-deployment-runbook.md",
  "stage-3b-rollback-drill.md",
  "stage-3c-production-smoke.md",
  "stage-3d-incident-response.md",
  "stage-3e-release-decision-record.md",
  "stage-3f-release-audit-index.md",
  "stage-3g-final-handoff-summary.md",
  "stage-3h-release-reviewer-faq.md",
  "stage-3i-final-documentation-index.md",
  "stage-3j-github-lovable-working-mode.md",
  "stage-3k-lovable-suggestions-backlog.md",
  "stage-3l-nightly-artifacts-report.md",
];

const NIGHTLY_FULL_WORKFLOW = ".github/workflows/e2e-nightly-full.yml";
const PACKAGE_JSON = "package.json";
const PREFLIGHT_SCRIPT = "scripts/preflight-auth-assets.mjs";
const E2E_ARTIFACT_PREFLIGHT_SCRIPT = "scripts/preflight-e2e-artifacts.mjs";
const ARTIFACT_SUMMARY_SCRIPT = "scripts/write-e2e-artifact-summary.mjs";
const ARTIFACT_SUMMARY_TEST = "scripts/write-e2e-artifact-summary.test.mjs";
const ARTIFACT_VIEWER_SCRIPT = "scripts/view-e2e-artifact-summary.mjs";
const ARTIFACT_VIEWER_TEST = "scripts/view-e2e-artifact-summary.test.mjs";

const errors = [];

function relPath(file) {
  return join(DOC_ROOT, file);
}

function readDoc(file) {
  const path = relPath(file);
  const abs = join(ROOT, path);
  if (!existsSync(abs)) {
    errors.push(`Missing required doc: ${path}`);
    return "";
  }
  return readFileSync(abs, "utf8");
}

function checkHeadings(file, content, headings) {
  for (const heading of headings) {
    if (!content.includes(heading)) {
      errors.push(`${relPath(file)} missing heading: ${heading}`);
    }
  }
}

function checkMarkdownLinks(file, content) {
  const sourceDir = dirname(relPath(file));
  const links = content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g);
  for (const match of links) {
    const target = match[1].split("#")[0];
    if (/^[a-z]+:\/\//i.test(target)) continue;
    const resolved = normalize(join(sourceDir, target));
    if (!existsSync(join(ROOT, resolved))) {
      errors.push(`${relPath(file)} has missing markdown link: ${target}`);
    }
  }
}

function checkPlainDocRefs(file, content) {
  const refs = content.matchAll(/docs\/frontend\/[A-Za-z0-9._-]+\.md/g);
  for (const match of refs) {
    const target = match[0];
    if (!existsSync(join(ROOT, target))) {
      errors.push(`${relPath(file)} has missing plain doc reference: ${target}`);
    }
  }
}

function requireText(label, content, expected) {
  if (!content.includes(expected)) {
    errors.push(`${label} missing required text: ${expected}`);
  }
}

for (const doc of EXPECTED) {
  const content = readDoc(doc.file);
  if (!content) continue;
  checkHeadings(doc.file, content, doc.headings);
  checkMarkdownLinks(doc.file, content);
  checkPlainDocRefs(doc.file, content);
}

const readiness = readDoc("stage-1i-auth-assets-readiness.md");
for (const ref of EXTRA_REQUIRED_REFS) {
  if (!readiness.includes(ref)) {
    errors.push(`${relPath("stage-1i-auth-assets-readiness.md")} missing Stage doc reference: ${ref}`);
  }
}
checkMarkdownLinks("stage-1i-auth-assets-readiness.md", readiness);
checkPlainDocRefs("stage-1i-auth-assets-readiness.md", readiness);
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "npm run preflight:e2e-artifacts");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "npm run view:e2e-artifacts");

const stage3c = readDoc("stage-3c-production-smoke.md");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "## 9. Nightly full e2e");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "## 10. Nightly artifacts report");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "Artifact bundle includes `playwright-report/` and `test-results/`");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "`test-results/e2e-nightly-full-vite.log`");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "`test-results/e2e-nightly-full-artifact-summary.md`");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "npm run view:e2e-artifacts");
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "./stage-3l-nightly-artifacts-report.md");

const nightlyWorkflowPath = join(ROOT, NIGHTLY_FULL_WORKFLOW);
const nightlyWorkflow = existsSync(nightlyWorkflowPath)
  ? readFileSync(nightlyWorkflowPath, "utf8")
  : "";
if (!nightlyWorkflow) {
  errors.push(`Missing required workflow: ${NIGHTLY_FULL_WORKFLOW}`);
}
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "playwright-report/");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "test-results/");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "FULL_E2E_REPORT_ENTRY: playwright-report/index.html");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "playwright-report/index.html");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "test-results/e2e-nightly-full-vite.log");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "FULL_E2E_REPORT_PATH: test-results/e2e-nightly-full-artifact-summary.md");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "FULL_E2E_UPLOAD_ARTIFACTS");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "upload_artifacts");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "cron: \"23 2 * * *\"");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "FULL_E2E_ARTIFACT_NAME: e2e-nightly-full-report-${{ github.run_id }}");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "npx playwright test --reporter=list,html --retries=\"$FULL_E2E_RETRIES\" --trace=retain-on-failure");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "Write nightly artifacts report");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "node scripts/write-e2e-artifact-summary.mjs \"$FULL_E2E_REPORT_PATH\"");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "E2E_ARTIFACT_REPORT_PATH: ${{ env.FULL_E2E_REPORT_ENTRY }}");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "E2E_ARTIFACT_SUMMARY_PATH: ${{ env.FULL_E2E_REPORT_PATH }}");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "E2E_ARTIFACT_SIZE_ROOT: ${{ github.workspace }}");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "actions/upload-artifact@v4");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "if-no-files-found: warn");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "retention-days: 7");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "env.FULL_E2E_UPLOAD_ARTIFACTS == 'always'");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "env.FULL_E2E_UPLOAD_ARTIFACTS == 'failure' && failure()");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "$GITHUB_STEP_SUMMARY");
requireText(NIGHTLY_FULL_WORKFLOW, nightlyWorkflow, "cat \"$FULL_E2E_REPORT_PATH\"");

const nightlyReport = readDoc("stage-3l-nightly-artifacts-report.md");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Artifact name pattern: `e2e-nightly-full-report-<run_id>`");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Retention: 7 days");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Generated summary path: `test-results/e2e-nightly-full-artifact-summary.md`");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Summary writer: `node scripts/write-e2e-artifact-summary.mjs`");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Summary viewer: `npm run view:e2e-artifacts -- test-results/e2e-nightly-full-artifact-summary.md`");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Report entry: `playwright-report/index.html`");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Artifact size check");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "`npm run preflight:e2e-artifacts`");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "playwright-report/");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "playwright-report/index.html");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/e2e-nightly-full-vite.log");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/e2e-nightly-full-artifact-summary.md");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Nightly full e2e report");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "Do not paste credentials, signed URLs, storage paths, access tokens");

const packageJson = existsSync(join(ROOT, PACKAGE_JSON))
  ? readFileSync(join(ROOT, PACKAGE_JSON), "utf8")
  : "";
requireText(PACKAGE_JSON, packageJson, "\"test:e2e-artifacts\": \"node --test scripts/write-e2e-artifact-summary.test.mjs scripts/view-e2e-artifact-summary.test.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"preflight:e2e-artifacts\": \"node scripts/preflight-e2e-artifacts.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"view:e2e-artifacts\": \"node scripts/view-e2e-artifact-summary.mjs\"");
requireText(PACKAGE_JSON, packageJson, "scripts/view-e2e-artifact-summary.test.mjs");

const preflightScript = existsSync(join(ROOT, PREFLIGHT_SCRIPT))
  ? readFileSync(join(ROOT, PREFLIGHT_SCRIPT), "utf8")
  : "";
requireText(PREFLIGHT_SCRIPT, preflightScript, "e2e artifact summary log-safety");
requireText(PREFLIGHT_SCRIPT, preflightScript, "test:e2e-artifacts");
requireText(PREFLIGHT_SCRIPT, preflightScript, "[preflight-auth-assets] Results");

const e2eArtifactPreflightScript = existsSync(join(ROOT, E2E_ARTIFACT_PREFLIGHT_SCRIPT))
  ? readFileSync(join(ROOT, E2E_ARTIFACT_PREFLIGHT_SCRIPT), "utf8")
  : "";
requireText(E2E_ARTIFACT_PREFLIGHT_SCRIPT, e2eArtifactPreflightScript, "preflight-e2e-artifacts");
requireText(E2E_ARTIFACT_PREFLIGHT_SCRIPT, e2eArtifactPreflightScript, "test:e2e-artifacts");
requireText(E2E_ARTIFACT_PREFLIGHT_SCRIPT, e2eArtifactPreflightScript, "scripts/check-stage3-docs.mjs");
requireText(E2E_ARTIFACT_PREFLIGHT_SCRIPT, e2eArtifactPreflightScript, "scripts/check-no-deno-locks.mjs");
requireText(E2E_ARTIFACT_PREFLIGHT_SCRIPT, e2eArtifactPreflightScript, "[preflight-e2e-artifacts] Results");

const artifactSummaryScript = existsSync(join(ROOT, ARTIFACT_SUMMARY_SCRIPT))
  ? readFileSync(join(ROOT, ARTIFACT_SUMMARY_SCRIPT), "utf8")
  : "";
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "Artifact size check");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "Report entry");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "Authorization:");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "refresh_token=");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "storage_object_path");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "Cookie:");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "patient_full_name");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "sb_publishable");
requireText(ARTIFACT_SUMMARY_SCRIPT, artifactSummaryScript, "redacted-jwt");

const artifactViewerScript = existsSync(join(ROOT, ARTIFACT_VIEWER_SCRIPT))
  ? readFileSync(join(ROOT, ARTIFACT_VIEWER_SCRIPT), "utf8")
  : "";
requireText(ARTIFACT_VIEWER_SCRIPT, artifactViewerScript, "E2E artifact report view");
requireText(ARTIFACT_VIEWER_SCRIPT, artifactViewerScript, "Missing artifact paths");
requireText(ARTIFACT_VIEWER_SCRIPT, artifactViewerScript, "view-e2e-artifact-summary");
requireText(ARTIFACT_VIEWER_SCRIPT, artifactViewerScript, "redact");

for (const path of [
  ARTIFACT_SUMMARY_SCRIPT,
  ARTIFACT_SUMMARY_TEST,
  E2E_ARTIFACT_PREFLIGHT_SCRIPT,
  ARTIFACT_VIEWER_SCRIPT,
  ARTIFACT_VIEWER_TEST,
]) {
  if (!existsSync(join(ROOT, path))) errors.push(`Missing required script: ${path}`);
}

if (errors.length > 0) {
  console.error("[check-stage3-docs] Stage 3 documentation check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[check-stage3-docs] OK (${EXPECTED.length} Stage 3 docs, headings and local links verified).`);
