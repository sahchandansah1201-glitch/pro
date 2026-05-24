#!/usr/bin/env node
// Stage 22A-22Z · Clinical follow-up configurable SOP policy templates guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-templates.stage22a-22z.json",
  "backend/self-hosted/db/migrations/0029_stage22_followup_sop_policy_templates.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage22a-22z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-22a-22z-clinical-followup-sop-policy-templates.md",
  ".github/workflows/stage22a-22z-clinical-followup-sop-policy-templates.yml",
  "package.json",
  "scripts/preflight-all.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md"
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/clinical-followup-sop-policy-templates.stage22a-22z.json": [
    "\"stage\": \"22A-22Z\"",
    "\"previousBatch\": \"Stage 21A-21Z\"",
    "\"nextBatchHypothesis\": \"Stage 23A-23Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 22A-22Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0029_stage22_followup_sop_policy_templates.sql": [
    "clinical_follow_up_sop_policy_templates",
    "clinical_follow_up_sop_policy_template_events",
    "idx_clinical_follow_up_sop_policy_templates_clinic_active"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyTemplateSummarySql",
    "buildListClinicalFollowUpSopPolicyTemplatesSql",
    "buildCreateClinicalFollowUpSopPolicyTemplateSql",
    "buildUpdateClinicalFollowUpSopPolicyTemplateSql"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyTemplatePayload",
    "clinical_follow_up.sop_policy_template.summary",
    "clinical_follow_up.sop_policy_template.create",
    "clinical_follow_up.sop_policy_template.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-templates/summary",
    "/api/v1/clinical/follow-ups/sop-policy-templates",
    "/api/v1/clinical/follow-ups/sop-policy-templates/{templateId}",
    "openapi.stage22a-22z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage22a-22z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyTemplateSummary",
    "listSelfHostedClinicalFollowUpSopPolicyTemplates",
    "createSelfHostedClinicalFollowUpSopPolicyTemplate",
    "updateSelfHostedClinicalFollowUpSopPolicyTemplate",
    "FollowUpSopPolicyTemplateSummary"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "SOP policy template",
    "createSelfHostedClinicalFollowUpSopPolicyTemplate",
    "activeSopPolicyVersion"
  ],
  "docs/backend/stage-22a-22z-clinical-followup-sop-policy-templates.md": [
    "Stage 22A-22Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage22a-22z-clinical-followup-sop-policy-templates.yml": [
    "name: stage22a-22z-clinical-followup-sop-policy-templates",
    "npm run preflight:stage22a-22z"
  ],
  "package.json": [
    "\"test:stage22a-22z\"",
    "\"check:stage22a-22z\"",
    "\"preflight:stage22a-22z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 22A-22Z clinical follow-up SOP policy templates preflight",
    "preflight:stage22a-22z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 22A-22Z",
    "clinical_followup_sop_policy_templates_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 22A-22Z",
    "SOP policy templates"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 22A-22Z",
    "Stage 23A-23Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 22A-22Z",
    "SOP policy templates"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 22A-22Z",
    "SOP policy templates"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-templates.stage22a-22z.json",
    "stage-22a-22z-clinical-followup-sop-policy-templates.md",
    "check-stage22a-22z-clinical-followup-sop-policy-templates.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-templates.stage22a-22z.json",
  "backend/self-hosted/db/migrations/0029_stage22_followup_sop_policy_templates.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-22a-22z-clinical-followup-sop-policy-templates.md"
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
  /external\s+sop\s+(completion|approval)\s+proof/i
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-templates.stage22a-22z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "22A-22Z") errors.push("Stage 22 manifest stage must be 22A-22Z");
  if (manifest.previousBatch !== "Stage 21A-21Z") errors.push("Stage 22 previous batch must be Stage 21A-21Z");
  if (manifest.nextBatchHypothesis !== "Stage 23A-23Z") errors.push("Stage 22 must record Stage 23A-23Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 22 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 22 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 22 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 22 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyTemplatesAreLocalConfigurationOnly) errors.push("Stage 22 SOP policy templates must be local configuration only");
  if (!manifest.privacy?.clinicSpecificSopIsNotExternalProof) errors.push("Stage 22 clinic SOP boundary must avoid external proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage22a-22z")) errors.push("Stage 22 preflight command missing");
}

export function checkStage22A22Z(root = process.cwd()) {
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
  const result = checkStage22A22Z(process.cwd());
  if (!result.ok) {
    console.error("[stage22a-22z-clinical-followup-sop-policy-templates] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage22a-22z-clinical-followup-sop-policy-templates] OK (${result.checkedFiles} files checked)`);
}
