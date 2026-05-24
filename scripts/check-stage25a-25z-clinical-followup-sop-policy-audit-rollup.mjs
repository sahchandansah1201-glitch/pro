#!/usr/bin/env node
// Stage 25A-25Z · Clinical follow-up local SOP policy audit rollup guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-audit-rollup.stage25a-25z.json",
  "backend/self-hosted/db/migrations/0032_stage25_followup_sop_policy_audit_rollup.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage25a-25z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-25a-25z-clinical-followup-sop-policy-audit-rollup.md",
  ".github/workflows/stage25a-25z-clinical-followup-sop-policy-audit-rollup.yml",
  "scripts/check-stage25a-25z-clinical-followup-sop-policy-audit-rollup.mjs",
  "scripts/check-stage25a-25z-clinical-followup-sop-policy-audit-rollup.test.mjs",
  "package.json",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md"
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/clinical-followup-sop-policy-audit-rollup.stage25a-25z.json": [
    "\"stage\": \"25A-25Z\"",
    "\"previousBatch\": \"Stage 24A-24Z\"",
    "\"nextBatchHypothesis\": \"Stage 26A-26Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 25A-25Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0032_stage25_followup_sop_policy_audit_rollup.sql": [
    "sop_policy_audit_state",
    "sop_policy_audit_reviewed_at",
    "clinical_follow_up_sop_policy_audit_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyAuditRollupSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyAuditRollupSql",
    "getClinicalFollowUpSopPolicyAuditRollupSummary",
    "updateClinicalFollowUpSopPolicyAuditRollup"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyAuditRollupPayload",
    "clinical_follow_up.sop_policy_audit_rollup.summary",
    "clinical_follow_up.sop_policy_audit_rollup.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-audit/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-audit",
    "openapi.stage25a-25z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage25a-25z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyAuditRollup",
    "FollowUpSopPolicyAuditRollupSummary",
    "FollowUpSopPolicyAuditState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Audit reviewed",
    "Audit follow-up",
    "sopPolicyAuditRollupSummary"
  ],
  "docs/backend/stage-25a-25z-clinical-followup-sop-policy-audit-rollup.md": [
    "Stage 25A-25Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage25a-25z-clinical-followup-sop-policy-audit-rollup.yml": [
    "name: stage25a-25z-clinical-followup-sop-policy-audit-rollup",
    "npm run preflight:stage25a-25z"
  ],
  "package.json": [
    "\"test:stage25a-25z\"",
    "\"check:stage25a-25z\"",
    "\"preflight:stage25a-25z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 25A-25Z clinical follow-up SOP policy audit rollup preflight",
    "preflight:stage25a-25z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 25A-25Z clinical follow-up SOP policy audit rollup preflight",
    "preflight:stage25a-25z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 25A-25Z",
    "clinical_followup_sop_policy_audit_rollup_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 25A-25Z",
    "SOP policy audit rollup"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 25A-25Z",
    "Stage 26A-26Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 25A-25Z",
    "SOP policy audit rollup"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 25A-25Z",
    "SOP policy audit rollup"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-audit-rollup.stage25a-25z.json",
    "stage-25a-25z-clinical-followup-sop-policy-audit-rollup.md",
    "check-stage25a-25z-clinical-followup-sop-policy-audit-rollup.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-audit-rollup.stage25a-25z.json",
  "backend/self-hosted/db/migrations/0032_stage25_followup_sop_policy_audit_rollup.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-25a-25z-clinical-followup-sop-policy-audit-rollup.md"
];

const FORBIDDEN = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /edge function/i,
  /SUPABASE_/i,
  /navigator\.(usb|bluetooth|serial)/i,
  /storage_object_path/i,
  /signed_url/i,
  /access_token/i,
  /object_bucket/i,
  /object_key/i,
  /vendor\s+(sms|email|notification)/i,
  /external\s+sop\s+(completion|approval)\s+proof/i,
  /medical\s+correctness\s+(proof|verification|guarantee)/i
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function checkMarkers(root, errors, table, label = "marker") {
  for (const [file, markers] of Object.entries(table)) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing ${label} file: ${file}`);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(`${file} missing ${label}: ${marker}`);
    }
  }
}

function validateManifest(root, errors) {
  const file = "deploy/self-hosted/clinical-followup-sop-policy-audit-rollup.stage25a-25z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "25A-25Z") errors.push("Stage 25 manifest stage must be 25A-25Z");
  if (manifest.previousBatch !== "Stage 24A-24Z") errors.push("Stage 25 previous batch must be Stage 24A-24Z");
  if (manifest.nextBatchHypothesis !== "Stage 26A-26Z") errors.push("Stage 25 must record Stage 26A-26Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 9) errors.push("Stage 25 must include at least 9 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 25 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 25 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 25 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyAuditRollupIsLocalMetadataOnly) errors.push("Stage 25 SOP policy audit rollup must be local metadata only");
  if (!manifest.privacy?.clinicSpecificSopIsNotExternalProof) errors.push("Stage 25 clinic SOP boundary must avoid external proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage25a-25z")) errors.push("Stage 25 preflight command missing");
}

export function checkStage25A25Z(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) errors.push(`${file} contains forbidden runtime marker: ${pattern}`);
    }
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage25A25Z(process.cwd());
  if (!result.ok) {
    console.error("[stage25a-25z-clinical-followup-sop-policy-audit-rollup] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage25a-25z-clinical-followup-sop-policy-audit-rollup] OK (${result.checkedFiles} files checked)`);
}
