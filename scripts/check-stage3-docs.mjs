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
      "## 8. Related dashboards",
    ],
  },
  {
    file: "stage-3m-release-operations-dashboard.md",
    headings: [
      "# Stage 3M — Release operations dashboard for auth/assets readiness",
      "## 1. Purpose",
      "## 2. Source scripts",
      "## 3. What the dashboard reports",
      "## 4. Privacy rules",
      "## 5. Local usage",
      "## 6. Output modes and release history",
      "## 7. Visual report",
      "## 8. Privacy detector",
      "## 9. CI automation",
      "## 10. Test coverage",
      "## 11. Local preflight",
      "## 12. System admin UI viewer",
      "## 13. Maintenance rule",
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
  "stage-3m-release-operations-dashboard.md",
];

const NIGHTLY_FULL_WORKFLOW = ".github/workflows/e2e-nightly-full.yml";
const RELEASE_STATUS_WORKFLOW = ".github/workflows/release-status.yml";
const PACKAGE_JSON = "package.json";
const PREFLIGHT_SCRIPT = "scripts/preflight-auth-assets.mjs";
const E2E_ARTIFACT_PREFLIGHT_SCRIPT = "scripts/preflight-e2e-artifacts.mjs";
const ARTIFACT_SUMMARY_SCRIPT = "scripts/write-e2e-artifact-summary.mjs";
const ARTIFACT_SUMMARY_TEST = "scripts/write-e2e-artifact-summary.test.mjs";
const ARTIFACT_VIEWER_SCRIPT = "scripts/view-e2e-artifact-summary.mjs";
const ARTIFACT_VIEWER_TEST = "scripts/view-e2e-artifact-summary.test.mjs";
const RELEASE_STATUS_SCRIPT = "scripts/release-status.mjs";
const RELEASE_STATUS_TEST = "scripts/release-status.test.mjs";
const RELEASE_STATUS_PRIVACY_SCRIPT = "scripts/check-release-status-privacy.mjs";
const RELEASE_STATUS_PRIVACY_TEST = "scripts/check-release-status-privacy.test.mjs";
const RELEASE_STATUS_SYNC_SCRIPT = "scripts/check-release-status-sync.mjs";
const RELEASE_STATUS_PREFLIGHT_SCRIPT = "scripts/preflight-release-status.mjs";
const RELEASE_STATUS_UI_LIB = "src/lib/release-status-ui.ts";
const RELEASE_STATUS_UI_LIB_TEST = "src/lib/release-status-ui.test.ts";
const RELEASE_STATUS_UI_PAGE = "src/pages/sys/SysReleaseStatusPage.tsx";
const RELEASE_STATUS_UI_PAGE_TEST = "src/pages/sys/SysReleaseStatusPage.test.tsx";
const RELEASE_STATUS_UI_E2E = "e2e/sys-release-status.pw.ts";
const APP_TSX = "src/App.tsx";
const APP_SIDEBAR = "src/components/shell/AppSidebar.tsx";

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
requireText(relPath("stage-3c-production-smoke.md"), stage3c, "sys-release-status");

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
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/release-status.md");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/release-status.json");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/release-status.html");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "test-results/release-history.jsonl");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "npm run check:release-status-privacy");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), nightlyReport, "release-status-<run_id>");

const packageJson = existsSync(join(ROOT, PACKAGE_JSON))
  ? readFileSync(join(ROOT, PACKAGE_JSON), "utf8")
  : "";
requireText(PACKAGE_JSON, packageJson, "\"test:e2e-artifacts\": \"node --test scripts/write-e2e-artifact-summary.test.mjs scripts/view-e2e-artifact-summary.test.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"preflight:e2e-artifacts\": \"node scripts/preflight-e2e-artifacts.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"preflight:release-status\": \"node scripts/preflight-release-status.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"view:e2e-artifacts\": \"node scripts/view-e2e-artifact-summary.mjs\"");
requireText(PACKAGE_JSON, packageJson, "scripts/view-e2e-artifact-summary.test.mjs");
requireText(PACKAGE_JSON, packageJson, "\"release:status\": \"node scripts/release-status.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"release:status:json\": \"node scripts/release-status.mjs --json\"");
requireText(PACKAGE_JSON, packageJson, "\"release:status:html\": \"node scripts/release-status.mjs --html\"");
requireText(PACKAGE_JSON, packageJson, "\"release:status:offline\": \"node scripts/release-status.mjs --offline\"");
requireText(PACKAGE_JSON, packageJson, "\"test:release-status\": \"node --test scripts/release-status.test.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"test:release-status-privacy\": \"node --test scripts/check-release-status-privacy.test.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"check:release-status-privacy\": \"node scripts/check-release-status-privacy.mjs\"");
requireText(PACKAGE_JSON, packageJson, "\"check:release-status-sync\": \"node scripts/check-release-status-sync.mjs\"");
requireText(PACKAGE_JSON, packageJson, "e2e/sys-release-status.pw.ts");

const releaseStatusScript = existsSync(join(ROOT, RELEASE_STATUS_SCRIPT))
  ? readFileSync(join(ROOT, RELEASE_STATUS_SCRIPT), "utf8")
  : "";
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "buildReleaseStatusReport");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "buildReleaseStatusJson");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "buildReleaseStatusHtml");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "buildReleaseHistoryEntry");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "Release operations dashboard");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "redact");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "--output");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "--json");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "--html");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "--history");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "GITHUB_TOKEN");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "no-deno-locks");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "auth-assets-smoke-skip");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "frontend-auth-assets");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "e2e-smoke");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "backend-guardrails");
requireText(RELEASE_STATUS_SCRIPT, releaseStatusScript, "e2e-nightly-full-artifact-summary.md");

const releaseStatusPrivacyScript = existsSync(join(ROOT, RELEASE_STATUS_PRIVACY_SCRIPT))
  ? readFileSync(join(ROOT, RELEASE_STATUS_PRIVACY_SCRIPT), "utf8")
  : "";
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "detectReleaseStatusPrivacyLeaks");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "Authorization");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "Cookie");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "access_token");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "patient_full_name");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "actor_email");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "storage_object_path");
requireText(RELEASE_STATUS_PRIVACY_SCRIPT, releaseStatusPrivacyScript, "SUPABASE_SERVICE_ROLE_KEY");

const releaseStatusPreflightScript = existsSync(join(ROOT, RELEASE_STATUS_PREFLIGHT_SCRIPT))
  ? readFileSync(join(ROOT, RELEASE_STATUS_PREFLIGHT_SCRIPT), "utf8")
  : "";
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "preflight-release-status");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "test:release-status");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "test:release-status-privacy");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "src/lib/release-status-ui.test.ts");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "src/pages/sys/SysReleaseStatusPage.test.tsx");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "release status sync checker");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "check:release-status-sync");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "release-status.html");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "release-history.jsonl");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "scripts/check-release-status-privacy.mjs");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "scripts/check-stage3-docs.mjs");
requireText(RELEASE_STATUS_PREFLIGHT_SCRIPT, releaseStatusPreflightScript, "scripts/check-no-deno-locks.mjs");

const releaseStatusWorkflow = existsSync(join(ROOT, RELEASE_STATUS_WORKFLOW))
  ? readFileSync(join(ROOT, RELEASE_STATUS_WORKFLOW), "utf8")
  : "";
if (!releaseStatusWorkflow) {
  errors.push(`Missing required workflow: ${RELEASE_STATUS_WORKFLOW}`);
}
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "npm run preflight:release-status");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "npm run check:release-status-sync");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "npm run release:status -- --output test-results/release-status.md --history test-results/release-history.jsonl");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "npm run release:status:json -- --output test-results/release-status.json");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "npm run release:status:html -- --output test-results/release-status.html");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "npm run check:release-status-privacy");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "$GITHUB_STEP_SUMMARY");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "actions/upload-artifact@v4");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "release-status-${{ github.run_id }}");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "test-results/release-status.html");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "test-results/release-history.jsonl");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "scripts/check-release-status-sync.mjs");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "src/lib/release-status-ui.ts");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "src/pages/sys/SysReleaseStatusPage.tsx");
requireText(RELEASE_STATUS_WORKFLOW, releaseStatusWorkflow, "e2e/sys-release-status.pw.ts");

const stage3m = readDoc("stage-3m-release-operations-dashboard.md");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "scripts/release-status.mjs");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "npm run release:status");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "--offline");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "--output <path>");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "npm run release:status:json");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "npm run release:status:html");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "--history <path>");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "scripts/check-release-status-privacy.mjs");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "npm run check:release-status-privacy");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "npm run preflight:release-status");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, ".github/workflows/release-status.yml");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "test-results/release-status.json");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "test-results/release-status.html");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "test-results/release-history.jsonl");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "/sys/release-status");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "src/pages/sys/SysReleaseStatusPage.tsx");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "src/lib/release-status-ui.ts");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "e2e/sys-release-status.pw.ts");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "tokens, cookies, signed URLs, emails");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "release-history.jsonl");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "choose an imported baseline");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "history-import");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "history-preview");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "import-audit");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "baseline-selector");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "history-pagination");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "history-filters");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "advanced-history-filters");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "audit-log-filters");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "audit-csv-export");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "operation-busy-states");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "edge-e2e-validation");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "filtered-history-export");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "import-error-summary");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "history-export-a11y");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "jsonl-validation");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "dry-run-import");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "audit-report-summary");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "audit-report-download");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "baseline-preview");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "baseline-delete");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "history-filter-presets");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "preset-management-ui");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "preset-json-xlsx-export");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "filtered-history-xlsx");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "import-error-actions");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "jsonl-error-line-selection");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "release-status-sync-checker-ui");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "release-status-sync-checker");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "npm run check:release-status-sync");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildReleaseImportAuditReport");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildFilteredReleaseHistoryJsonl");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildFilteredReleaseHistoryCsv");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildFilteredReleaseHistoryXlsxBytes");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildReleaseHistoryFilterPreset");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "normalizeReleaseHistoryFilterPreset");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildReleaseHistoryPresetExportJson");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "buildReleaseHistoryPresetsXlsxBytes");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "parseReleaseHistoryPresetExportJson");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "releaseHistoryFilteredXlsxFilename");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "summarizeReleaseHistoryIssues");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "filterReleaseHistoryRecords");
requireText(relPath("stage-3m-release-operations-dashboard.md"), stage3m, "paginateReleaseHistoryRecords");
checkMarkdownLinks("stage-3m-release-operations-dashboard.md", stage3m);

const stage3l = readDoc("stage-3l-nightly-artifacts-report.md");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), stage3l, "## 8. Related dashboards");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), stage3l, "npm run release:status");
requireText(relPath("stage-3l-nightly-artifacts-report.md"), stage3l, "./stage-3m-release-operations-dashboard.md");

requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "npm run release:status");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "npm run preflight:release-status");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "npm run check:release-status-privacy");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "test-results/release-status.md");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "test-results/release-status.json");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "test-results/release-status.html");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "/sys/release-status");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "e2e/sys-release-status.pw.ts");
requireText(relPath("stage-1i-auth-assets-readiness.md"), readiness, "stage-3m-release-operations-dashboard.md");

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
requireText(E2E_ARTIFACT_PREFLIGHT_SCRIPT, e2eArtifactPreflightScript, "test:release-status");
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

const releaseStatusUiLib = existsSync(join(ROOT, RELEASE_STATUS_UI_LIB))
  ? readFileSync(join(ROOT, RELEASE_STATUS_UI_LIB), "utf8")
  : "";
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseStatusHtml");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseHistoryJsonl");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseStatusExportBundle");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "compareReleaseStatusSnapshots");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "detectReleaseStatusUiPrivacyLeaks");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "RELEASE_STATUS_ALLOWED_ROLES");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "RELEASE_STATUS_PREFLIGHT_COMMAND");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "RELEASE_STATUS_PRIVACY_CATEGORIES");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "parseReleaseHistoryJsonl");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseBaselineOptions");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "releaseSnapshotFromHistoryRecord");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "summarizeReleaseHistoryPreview");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "RELEASE_STATUS_DEMO_HISTORY_JSONL");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "ReleaseHistoryParseIssue");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "filterReleaseHistoryRecords");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "filterReleaseHistoryRecordsAdvanced");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "filterReleaseImportAuditEntries");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "paginateReleaseHistoryRecords");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "ReleaseHistoryPage");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseImportAuditReport");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseImportAuditCsv");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "releaseHistoryAuditFilename");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "releaseHistoryAuditCsvFilename");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildFilteredReleaseHistoryJsonl");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildFilteredReleaseHistoryCsv");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildFilteredReleaseHistoryXlsxBytes");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "buildReleaseHistoryFilterPreset");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "normalizeReleaseHistoryFilterPreset");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "releaseHistoryFilteredJsonlFilename");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "releaseHistoryFilteredCsvFilename");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "releaseHistoryFilteredXlsxFilename");
requireText(RELEASE_STATUS_UI_LIB, releaseStatusUiLib, "summarizeReleaseHistoryIssues");

const releaseStatusUiPage = existsSync(join(ROOT, RELEASE_STATUS_UI_PAGE))
  ? readFileSync(join(ROOT, RELEASE_STATUS_UI_PAGE), "utf8")
  : "";
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Предпросмотр release status");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сравнение релизов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Импорт release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Вставить release-history JSONL");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Выбрать baseline release status");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Предпросмотр истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Аудит импортов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Privacy статус импорта release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Dry-run импорт");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фильтр статуса истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фильтр deno-lock истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фильтр artifact истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фильтр workflow результата истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Поиск по release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сводка фильтров release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сбросить фильтры release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сводка ошибок импорта release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Экспортировать отфильтрованную release history в JSONL");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Экспортировать отфильтрованную release history в CSV");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Экспортировать отфильтрованную release history в XLSX");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Пресет фильтров release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сводка пресетов release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сохранить текущие фильтры release history как пресет");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Удалить сохранённый пресет release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Подсказки исправления release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фокус на JSONL с ошибкой");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Пагинация release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Предыдущая страница истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Следующая страница истории");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Ошибки формата release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Удалить импортированные baseline");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Скачать JSON отчет аудита импортов release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Скачать CSV отчет аудита импортов release history");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фильтр статуса аудита импортов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Фильтр приватности аудита импортов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Поиск по аудиту импортов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сводка фильтров аудита импортов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Сбросить фильтры аудита импортов");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Предпросмотр выбранного baseline");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Экспортировать единый пакет release status");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Экспортировать release status");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Категории проверки приватности");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Подготовить локальный запуск");
requireText(RELEASE_STATUS_UI_PAGE, releaseStatusUiPage, "Статус релиз-дашборда");

const releaseStatusUiE2e = existsSync(join(ROOT, RELEASE_STATUS_UI_E2E))
  ? readFileSync(join(ROOT, RELEASE_STATUS_UI_E2E), "utf8")
  : "";
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "/sys/release-status");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "clinic_admin");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Импортировать history JSONL");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Импорт заблокирован");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Предпросмотр истории");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Аудит импортов release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Dry-run импорт");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Фильтр статуса истории");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Фильтр deno-lock истории");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Фильтр artifact истории");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Фильтр workflow результата истории");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Сводка фильтров release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Сводка ошибок импорта release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Экспортировать отфильтрованную release history в JSONL");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Экспортировать отфильтрованную release history в CSV");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Экспортировать отфильтрованную release history в XLSX");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Пресет фильтров release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Фокус на JSONL с ошибкой");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "release-history-filtered");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Пагинация release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Следующая страница истории");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Ошибки формата release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Удалить импортированные baseline");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Скачать JSON отчет аудита импортов release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Скачать CSV отчет аудита импортов release history");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Сводка фильтров аудита импортов");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Предпросмотр выбранного baseline");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "\"summary\"");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Экспортировать единый пакет release status");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "Экспортировать release status в HTML");
requireText(RELEASE_STATUS_UI_E2E, releaseStatusUiE2e, "storage_object_path");

const appTsx = existsSync(join(ROOT, APP_TSX)) ? readFileSync(join(ROOT, APP_TSX), "utf8") : "";
requireText(APP_TSX, appTsx, "SysReleaseStatusPage");
requireText(APP_TSX, appTsx, "/sys/release-status");

const appSidebar = existsSync(join(ROOT, APP_SIDEBAR)) ? readFileSync(join(ROOT, APP_SIDEBAR), "utf8") : "";
requireText(APP_SIDEBAR, appSidebar, "Релиз-статус");
requireText(APP_SIDEBAR, appSidebar, "/sys/release-status");

for (const path of [
  ARTIFACT_SUMMARY_SCRIPT,
  ARTIFACT_SUMMARY_TEST,
  E2E_ARTIFACT_PREFLIGHT_SCRIPT,
  ARTIFACT_VIEWER_SCRIPT,
  ARTIFACT_VIEWER_TEST,
  RELEASE_STATUS_SCRIPT,
  RELEASE_STATUS_TEST,
  RELEASE_STATUS_PRIVACY_SCRIPT,
  RELEASE_STATUS_PRIVACY_TEST,
  RELEASE_STATUS_SYNC_SCRIPT,
  RELEASE_STATUS_PREFLIGHT_SCRIPT,
  RELEASE_STATUS_UI_LIB,
  RELEASE_STATUS_UI_LIB_TEST,
  RELEASE_STATUS_UI_PAGE,
  RELEASE_STATUS_UI_PAGE_TEST,
  RELEASE_STATUS_UI_E2E,
]) {
  if (!existsSync(join(ROOT, path))) errors.push(`Missing required script: ${path}`);
}

if (errors.length > 0) {
  console.error("[check-stage3-docs] Stage 3 documentation check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[check-stage3-docs] OK (${EXPECTED.length} Stage 3 docs, headings and local links verified).`);
