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
];

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

if (errors.length > 0) {
  console.error("[check-stage3-docs] Stage 3 documentation check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[check-stage3-docs] OK (${EXPECTED.length} Stage 3 docs, headings and local links verified).`);
