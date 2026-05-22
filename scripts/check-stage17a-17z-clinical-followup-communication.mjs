#!/usr/bin/env node
// Stage 17A-17Z · Clinical follow-up communication guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-communication.stage17a-17z.json",
  "backend/self-hosted/db/migrations/0024_stage17_clinical_followup_communication.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage17a-17z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "src/pages/patient/MeRemindersPageLive.tsx",
  "src/pages/patient/MePages.production.test.tsx",
  "docs/backend/stage-17a-17z-clinical-followup-communication.md",
  ".github/workflows/stage17a-17z-clinical-followup-communication.yml",
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
  "deploy/self-hosted/clinical-followup-communication.stage17a-17z.json": [
    "\"stage\": \"17A-17Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 17A-17Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0024_stage17_clinical_followup_communication.sql": [
    "clinical_follow_up_tasks",
    "clinical_follow_up_messages",
    "local_only"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildListClinicalFollowUpsSql",
    "buildCreatePatientFollowUpMessageSql",
    "patient_user_links",
    "null as \\\"internalNote\\\""
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "clinical_follow_up.create",
    "clinical_follow_up.message.create",
    "patient_portal.follow_up.message.create"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups",
    "/api/v1/me/follow-ups",
    "openapi.stage17a-17z.json",
    "clinicalFollowUpService"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "listSelfHostedClinicalFollowUps",
    "createSelfHostedVisitFollowUp",
    "listSelfHostedPatientFollowUps",
    "createSelfHostedPatientFollowUpMessage"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Контроль и связь",
    "createSelfHostedVisitFollowUp"
  ],
  "src/pages/patient/MeRemindersPageLive.tsx": [
    "Контроль и сообщения клиники",
    "createSelfHostedPatientFollowUpMessage"
  ],
  "docs/backend/stage-17a-17z-clinical-followup-communication.md": [
    "Stage 17A-17Z",
    "Clinical follow-up and patient communication loop",
    "Managed runtime/database dependency: none"
  ],
  ".github/workflows/stage17a-17z-clinical-followup-communication.yml": [
    "name: stage17a-17z-clinical-followup-communication",
    "npm run preflight:stage17a-17z"
  ],
  "package.json": [
    "\"test:stage17a-17z\"",
    "\"check:stage17a-17z\"",
    "\"preflight:stage17a-17z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 17A-17Z clinical follow-up communication preflight",
    "preflight:stage17a-17z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage17a_17z_preflight",
    "clinical_followup_communication_confirmed: true",
    "Stage 17A-17Z"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 17A-17Z",
    "clinical follow-up and patient communication loop"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 17A-17Z",
    "Stage 18A-18Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 17A-17Z",
    "clinical follow-up"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 17A-17Z",
    "managed notification provider"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-communication.stage17a-17z.json",
    "stage-17a-17z-clinical-followup-communication.md",
    "check-stage17a-17z-clinical-followup-communication.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-communication.stage17a-17z.json",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/patient/MeRemindersPageLive.tsx",
  "docs/backend/stage-17a-17z-clinical-followup-communication.md"
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
  /external notification provider/i
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
  const file = "deploy/self-hosted/clinical-followup-communication.stage17a-17z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "17A-17Z") errors.push("Stage 17 manifest stage must be 17A-17Z");
  if (manifest.previousBatch !== "Stage 16A-16Z") errors.push("Stage 17 previous batch must be Stage 16A-16Z");
  if (manifest.nextBatchHypothesis !== "Stage 18A-18Z") errors.push("Stage 17 must record Stage 18A-18Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 7) errors.push("Stage 17 must include at least 7 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 17 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 17 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 17 managed notification dependency must be none");
  if (!manifest.privacy?.patientEndpointHidesInternalNote) errors.push("Stage 17 patient endpoint must hide internal notes");
  if (!manifest.verification?.preflight?.includes("preflight:stage17a-17z")) errors.push("Stage 17 preflight command missing");
}

export function checkStage17A17Z(root = process.cwd()) {
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
  const result = checkStage17A17Z(process.cwd());
  if (!result.ok) {
    console.error("[stage17a-17z-clinical-followup-communication] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage17a-17z-clinical-followup-communication] OK (${result.checkedFiles} files checked)`);
}
