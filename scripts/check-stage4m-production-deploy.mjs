#!/usr/bin/env node
// Stage 4M · Production deployment verification guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "scripts/stage4m-production-deploy-verify.mjs",
  "scripts/stage4m-production-deploy-verify.test.mjs",
  "scripts/stage4m-production-deploy-status.mjs",
  "scripts/stage4m-production-deploy-status.test.mjs",
  "scripts/stage4m-self-hosted-schema-migrations.mjs",
  "scripts/stage4m-self-hosted-schema-migrations.test.mjs",
  "backend/self-hosted/db/migrations/0090_stage6_service_keys.sql",
  "backend/self-hosted/db/migrations/0091_stage6_clinic_services.sql",
  "backend/self-hosted/db/migrations/0092_stage6_admin_integrations_bot.sql",
  "backend/self-hosted/db/migrations/0093_stage6_public_analysis_links.sql",
  "backend/self-hosted/public-analysis-repository.mjs",
  "backend/self-hosted/public-analysis-repository.test.mjs",
  "backend/self-hosted/public-analysis-routes.mjs",
  "backend/self-hosted/public-analysis-routes.test.mjs",
  "backend/self-hosted/public-analysis-service.mjs",
  "backend/self-hosted/public-analysis-service.test.mjs",
  "scripts/stage4m-admin-management-db-smoke.mjs",
  "scripts/stage4m-admin-management-db-smoke.test.mjs",
  "scripts/stage4m-admin-services-db-smoke.mjs",
  "scripts/stage4m-admin-services-db-smoke.test.mjs",
  "scripts/stage4m-admin-integrations-bot-db-smoke.mjs",
  "scripts/stage4m-admin-integrations-bot-db-smoke.test.mjs",
  "scripts/stage4m-admin-governance-db-smoke.mjs",
  "scripts/stage4m-admin-governance-db-smoke.test.mjs",
  "scripts/stage4m-device-bridge-db-smoke.mjs",
  "scripts/stage4m-device-bridge-db-smoke.test.mjs",
  "scripts/stage4m-doctor-lead-db-smoke.mjs",
  "scripts/stage4m-doctor-lead-db-smoke.test.mjs",
  "scripts/stage4m-doctor-patient-db-smoke.mjs",
  "scripts/stage4m-doctor-patient-db-smoke.test.mjs",
  "scripts/stage4m-doctor-visit-report-db-smoke.mjs",
  "scripts/stage4m-doctor-visit-report-db-smoke.test.mjs",
  "scripts/stage4m-assistant-capture-db-smoke.mjs",
  "scripts/stage4m-assistant-capture-db-smoke.test.mjs",
  "scripts/stage4m-patient-portal-db-smoke.mjs",
  "scripts/stage4m-patient-portal-db-smoke.test.mjs",
  "scripts/stage4m-operator-dialog-db-smoke.mjs",
  "scripts/stage4m-operator-dialog-db-smoke.test.mjs",
  "scripts/stage4m-bot-booking-db-smoke.mjs",
  "scripts/stage4m-bot-booking-db-smoke.test.mjs",
  "scripts/stage4m-public-analysis-db-smoke.mjs",
  "scripts/stage4m-public-analysis-db-smoke.test.mjs",
  "scripts/stage4m-admin-management-api-smoke.mjs",
  "scripts/stage4m-admin-management-api-smoke.test.mjs",
  "scripts/run-production-admin-management-live-e2e.mjs",
  "scripts/run-production-admin-management-live-e2e.test.mjs",
  "scripts/run-production-auth-session-live-e2e.mjs",
  "scripts/run-production-auth-session-live-e2e.test.mjs",
  "scripts/run-production-doctor-workspace-live-e2e.mjs",
  "scripts/run-production-doctor-workspace-live-e2e.test.mjs",
  "scripts/run-production-assistant-workspace-live-e2e.mjs",
  "scripts/run-production-assistant-workspace-live-e2e.test.mjs",
  "scripts/run-production-operator-workspace-live-e2e.mjs",
  "scripts/run-production-operator-workspace-live-e2e.test.mjs",
  "scripts/run-production-patient-portal-live-e2e.mjs",
  "scripts/run-production-patient-portal-live-e2e.test.mjs",
  "scripts/run-production-bot-booking-live-e2e.mjs",
  "scripts/run-production-bot-booking-live-e2e.test.mjs",
  "scripts/run-production-public-analysis-live-e2e.mjs",
  "scripts/run-production-public-analysis-live-e2e.test.mjs",
  "scripts/run-production-rds3-import-live-e2e.mjs",
  "scripts/run-production-rds3-import-live-e2e.test.mjs",
  "e2e/live-admin-test-helpers.ts",
  "e2e/production-auth-session-live.pw.ts",
  "e2e/production-admin-management-live.pw.ts",
  "e2e/production-doctor-workspace-live.pw.ts",
  "e2e/production-assistant-workspace-live.pw.ts",
  "e2e/production-operator-workspace-live.pw.ts",
  "e2e/production-patient-portal-live.pw.ts",
  "e2e/production-bot-booking-live.pw.ts",
  "e2e/production-public-analysis-live.pw.ts",
  "e2e/production-rds3-import-live.pw.ts",
  "src/lib/self-hosted-public-analysis-api.ts",
  "src/lib/self-hosted-public-analysis-api.test.ts",
  "src/pages/public/AnalysisPublicPage.production.test.tsx",
  "src/pages/admin/AdminServicesPage.tsx",
  "src/pages/admin/AdminIntegrationsPage.tsx",
  "src/pages/admin/AdminIntegrationDetailPage.tsx",
  "src/pages/admin/AdminBotSettingsPage.tsx",
  "src/pages/doctor/DoctorReportsPage.tsx",
  "src/pages/doctor/DoctorReportsPageLive.tsx",
  "scripts/check-stage4m-production-deploy.mjs",
  "scripts/check-stage4m-production-deploy.test.mjs",
  "docs/backend/stage-4m-production-deployment-verification.md",
  ".github/workflows/stage4m-production-deployment-verification.yml",
  "deploy/self-hosted/.env.production.example",
  "deploy/self-hosted/update-production.sh",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "scripts/stage4l-self-hosted-ops.mjs",
  "scripts/stage4k-self-hosted-compose-smoke.mjs",
];

const REQUIRED_TEXT = {
  "scripts/stage4m-production-deploy-verify.mjs": [
    "first-boot",
    "post-deploy",
    "backup-after-deploy",
    "rollback-drill",
    "update",
    "VITE_APP_MODE",
    "VITE_SELF_HOSTED_API_BASE_URL",
    "safeFrontendBuild",
    "dist/index.html",
    "stage4m-production-deploy-receipt/v1",
    "latestSummaryPath",
    "latestStatusPath",
    "Git HEAD before",
    "START",
    "FAIL",
    "Apply production schema migrations",
    "stage4m-self-hosted-schema-migrations.mjs",
    "Verify admin clinic create/edit, account safety, password reset and audit isolation database journey",
    "stage4m-admin-management-db-smoke.mjs",
    "Verify admin service catalog database journey",
    "stage4m-admin-services-db-smoke.mjs",
    "Verify admin integrations and bot database journey",
    "stage4m-admin-integrations-bot-db-smoke.mjs",
    "Verify admin governance database journey",
    "stage4m-admin-governance-db-smoke.mjs",
    "Verify device bridge registry database journey",
    "stage4m-device-bridge-db-smoke.mjs",
    "Verify doctor lead create/update/book database journey",
    "stage4m-doctor-lead-db-smoke.mjs",
    "Verify doctor patient create/edit/archive database journey",
    "stage4m-doctor-patient-db-smoke.mjs",
    "Verify doctor visit/report database journey",
    "stage4m-doctor-visit-report-db-smoke.mjs",
    "Verify assistant capture and RDS-3 import database journey",
    "stage4m-assistant-capture-db-smoke.mjs",
    "Verify patient portal booking/reminder database journey",
    "stage4m-patient-portal-db-smoke.mjs",
    "Verify operator dialog database journey",
    "stage4m-operator-dialog-db-smoke.mjs",
    "Verify bot mini app booking database journey",
    "stage4m-bot-booking-db-smoke.mjs",
    "Verify public analysis link database journey",
    "stage4m-public-analysis-db-smoke.mjs",
    "--retry-all-errors",
    "--retry-delay",
    "ROLLBACK_TO_SELF_HOSTED_BACKUP",
    "smoke:stage4k",
    "ops:stage4l:verify-env",
    "docker-compose.production.example.yml",
  ],
  "scripts/stage4m-production-deploy-status.mjs": [
    "Stage 4M deployment status",
    "update-production-status.json",
    "Git HEAD after",
    "stage4m-production-deploy-receipt/v1",
  ],
  "scripts/stage4m-self-hosted-schema-migrations.mjs": [
    "0086_stage6_admin_management.sql",
    "0087_stage6_clinic_address.sql",
    "0088_stage6_admin_lifecycle.sql",
    "0090_stage6_service_keys.sql",
    "0091_stage6_clinic_services.sql",
    "0092_stage6_admin_integrations_bot.sql",
    "0093_stage6_public_analysis_links.sql",
    "private_doctor",
    "clinicAddressColumn",
    "clinics.address column",
    "clinicStatusColumn",
    "clinics.status column",
    "clinicDeletedAtColumn",
    "clinics.deleted_at column",
    "userRoleDisabledAtColumn",
    "user_roles.disabled_at column",
    "serviceApiKeysTable",
    "service_api_keys table",
    "clinicServicesTable",
    "clinic_services table",
    "clinicServicesRequiredColumns",
    "clinic_services columns",
    "clinicIntegrationsTable",
    "clinic_integrations table",
    "clinicIntegrationsRequiredColumns",
    "clinic_integrations columns",
    "clinicBotSettingsTable",
    "clinic_bot_settings table",
    "clinicBotSettingsRequiredColumns",
    "clinic_bot_settings columns",
    "publicAnalysisLinksTable",
    "public_analysis_links table",
    "publicAnalysisLinksRequiredColumns",
    "public_analysis_links columns",
    "No raw tokens, passwords, patient names, object keys, or storage paths are printed.",
  ],
  "scripts/stage4m-admin-management-db-smoke.mjs": [
    "stage4m_admin_management_db_smoke_ok",
    "admin clinic create did not persist the clinic row",
    "admin clinic list did not include the created clinic",
    "admin clinic update did not persist editable fields",
    "rollback;",
  ],
  "scripts/stage4m-admin-services-db-smoke.mjs": [
    "stage4m_admin_services_db_smoke_ok",
    "admin service create did not persist the service row",
    "admin service list did not include the created service",
    "admin service update did not persist editable fields",
    "buildCreateClinicServiceSql",
    "buildListClinicServicesSql",
    "buildUpdateClinicServiceSql",
    "rollback;",
  ],
  "scripts/stage4m-admin-integrations-bot-db-smoke.mjs": [
    "stage4m_admin_integrations_bot_db_smoke_ok",
    "admin integration create did not persist the integration row",
    "admin integration list did not include the created integration",
    "admin integration update/check did not return updated fields",
    "admin bot settings save did not return enabled settings",
    "admin bot dry-run did not update last check time",
    "buildCreateClinicIntegrationSql",
    "buildListClinicIntegrationsSql",
    "buildUpdateClinicIntegrationSql",
    "buildUpsertClinicBotSettingsSql",
    "rollback;",
  ],
  "scripts/stage4m-admin-governance-db-smoke.mjs": [
    "stage4m_admin_governance_db_smoke_ok",
    "admin governance read did not return aggregate metadata only",
    "admin governance block unapproved retention did not close retention gaps safely",
    "admin governance block missing expiry did not close expiry gaps safely",
    "admin governance block unsafe session artifacts did not close temporary codes safely",
    "admin governance access-artifact rotation was not prepared safely",
    "admin governance credential-hash operation was not metadata-only",
    "admin governance revoke expired windows did not keep revoke reason hidden",
    "buildGetPatientPhotoProtocolReleaseGovernanceSql",
    "buildExecutePatientPhotoProtocolReleaseGovernanceBlockMissingExpirySql",
    "buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionSql",
    "buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsSql",
    "buildExecutePatientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationSql",
    "buildExecutePatientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashSql",
    "buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql",
    "rollback;",
  ],
  "scripts/stage4m-device-bridge-db-smoke.mjs": [
    "stage4m_device_bridge_db_smoke_ok",
    "device bridge registry did not return the fixture bridge",
    "device registry did not return the fixture device",
    "device bridge command create did not return queued command",
    "device bridge worker telemetry did not return safe summary",
    "device bridge worker hardening did not return policy summary",
    "device bridge worker recovery did not return actionable queue summary",
    "device bridge worker audit did not return metadata-only summary",
    "buildListDeviceBridgesSql",
    "buildListMedicalDevicesSql",
    "buildGetBridgeForCommandSql",
    "buildGetDeviceForCommandSql",
    "buildCreateDeviceBridgeCommandSql",
    "buildListWorkerTelemetrySql",
    "buildListWorkerHardeningSql",
    "buildListWorkerRecoverySql",
    "buildListWorkerCommandAuditSql",
    "rollback;",
  ],
  "scripts/stage4m-doctor-lead-db-smoke.mjs": [
    "stage4m_doctor_lead_db_smoke_ok",
    "doctor lead create did not return the created lead",
    "doctor lead status update did not return qualified status",
    "doctor lead booking did not return booked lead and appointment",
    "buildCreateLeadSql",
    "buildUpdateLeadStatusSql",
    "buildBookLeadAppointmentSql",
    "rollback;",
  ],
  "scripts/stage4m-doctor-patient-db-smoke.mjs": [
    "stage4m_doctor_patient_db_smoke_ok",
    "doctor patient create did not return the created patient",
    "doctor patient update did not return updated patient",
    "doctor patient archive did not return archived patient",
    "buildCreatePatientSql",
    "buildUpdatePatientSql",
    "buildArchivePatientSql",
    "rollback;",
  ],
  "scripts/stage4m-doctor-visit-report-db-smoke.mjs": [
    "stage4m_doctor_visit_report_db_smoke_ok",
    "doctor visit schedule did not return the fixture visit",
    "doctor visit detail did not return the fixture visit",
    "doctor visit report did not return the fixture report",
    "doctor report package did not return report readiness",
    "buildVisitScheduleSql",
    "buildGetVisitSql",
    "buildGetVisitReportSql",
    "buildGetClinicalReportPackageSql",
    "rollback;",
  ],
  "scripts/stage4m-assistant-capture-db-smoke.mjs": [
    "stage4m_assistant_capture_db_smoke_ok",
    "assistant capture asset create did not return dermoscopy asset",
    "assistant capture asset create did not preserve assistant uploader",
    "assistant capture asset safe DTO exposed object storage details",
    "RDS-3 capture metadata did not preserve device bridge source",
    "buildCreateVisitAssetSql",
    "rollback;",
  ],
  "scripts/run-production-rds3-import-live-e2e.mjs": [
    "--receipt-file",
    "--visit-id",
    "validateRds3Receipt",
    "deployStatusBlocksLiveE2E",
    "production-rds3-import-live.pw.ts",
  ],
  "scripts/stage4m-patient-portal-db-smoke.mjs": [
    "stage4m_patient_portal_db_smoke_ok",
    "patient portal overview did not return the linked patient",
    "patient portal overview did not return patient-safe report summary",
    "patient portal report detail did not return patient-safe report",
    "patient portal follow-ups did not return patient-safe follow-up list",
    "patient portal booking request did not return requested booking",
    "patient portal reminder preferences did not return saved preferences",
    "buildListPatientFollowUpsSql",
    "buildPatientPortalOverviewSql",
    "buildPatientPortalReportSql",
    "buildCreatePatientPortalBookingRequestSql",
    "buildUpdatePatientPortalReminderPreferencesSql",
    "rollback;",
  ],
  "scripts/stage4m-operator-dialog-db-smoke.mjs": [
    "stage4m_operator_dialog_db_smoke_ok",
    "operator dialog detail did not return the scoped request",
    "operator dialog update did not persist note and status",
    "operator dialog detail did not return the persisted update",
    "buildClinicBookingRequestDetailSql",
    "buildUpdateClinicBookingRequestSql",
    "rollback;",
  ],
  "scripts/stage4m-bot-booking-db-smoke.mjs": [
    "stage4m_bot_booking_db_smoke_ok",
    "bot mini app booking request did not return requested booking",
    "buildCreatePatientPortalBookingRequestSql",
    "patient_user_links",
    "rollback;",
  ],
  "scripts/stage4m-public-analysis-db-smoke.mjs": [
    "stage4m_public_analysis_db_smoke_ok",
    "public analysis valid link did not return patient-safe summary",
    "public analysis expired link did not return expired status without summary",
    "public analysis missing link did not return not_found status",
    "buildGetPublicAnalysisByTokenHashSql",
    "hashPublicAnalysisToken",
    "rollback;",
  ],
  "scripts/stage4m-admin-management-api-smoke.mjs": [
    "I_CONFIRM_CREATE_TEST_CLINIC",
    "assertDeployReadyForStage4MMutation",
    "Stage 4M deployment is still running",
    "/api/v1/auth/login",
    "/api/v1/admin/clinics",
    "createdClinicVisibleInList",
    "updatedClinicVisibleInList",
    "redactSecrets",
  ],
  "scripts/run-production-admin-management-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-admin-management-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Stage 4M deployment is still running",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_ADMIN_BASE_URL",
    "STAGE4M_ADMIN_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-auth-session-live-e2e.mjs": [
    "production-auth-session-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "expectedHead: head",
    "Current Git HEAD is unavailable",
    "STAGE4M_LIVE_AUTH_BASE_URL",
    "STAGE4M_AUTH_CREDENTIALS_FILE",
    "Credentials file not found",
  ],
  "scripts/run-production-doctor-workspace-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-doctor-workspace-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_DOCTOR_BASE_URL",
    "STAGE4M_DOCTOR_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-assistant-workspace-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-assistant-workspace-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_ASSISTANT_BASE_URL",
    "STAGE4M_ASSISTANT_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-operator-workspace-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-operator-workspace-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_OPERATOR_BASE_URL",
    "STAGE4M_OPERATOR_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-patient-portal-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-patient-portal-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_PATIENT_BASE_URL",
    "STAGE4M_PATIENT_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-bot-booking-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-bot-booking-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_BOT_BOOKING_BASE_URL",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
  ],
  "scripts/run-production-public-analysis-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-public-analysis-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_PUBLIC_ANALYSIS_BASE_URL",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
  ],
  "e2e/production-admin-management-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "Адрес системы клиники",
    "Клиники и кабинеты",
    "Создать клинику",
    "Создание сотрудника",
    "123456789",
    "Временный пароль должен быть не короче 10 символов.",
    "adminUserCreateRequestCount",
    "live-admin-users-validation-desktop-1280.png",
    "live-admin-users-validation-mobile-390.png",
    "ФИО ассистента",
    "Клиника ассистента",
    "Добавить ассистента",
    "Ассистент добавлен",
    "assistantCreateRequestsBeforeValidation",
    "Разделы сотрудников",
    "Учётная запись и роль — разные уровни доступа.",
    "Поиск сотрудников",
    "Фильтр доступа",
    "Приостановить роль врача",
    "Задать новый пароль",
    "Новый пароль должен быть не короче 10 символов.",
    "passwordResetResponsePromise",
    "live-clinic-admin-doctors-desktop-1280.png",
    "live-clinic-admin-doctors-mobile-390.png",
    "live-clinic-admin-assistants-desktop-1280.png",
    "live-clinic-admin-assistants-mobile-390.png",
    "live-clinic-admin-access-desktop-1280.png",
    "live-clinic-admin-access-mobile-390.png",
    "live-clinic-admin-password-desktop-1280.png",
    "live-clinic-admin-password-mobile-390.png",
    "clinicAdminRecentAuditEvents",
    "Клиника сохранена и добавлена в список",
    "Редактирование клиники",
    "Сохранить изменения",
    "Invalid or expired authorization token",
    "Database is unavailable",
    "live-admin-clinics-desktop-1280.png",
    "live-admin-clinics-mobile-390.png",
    "Служебные ключи",
    "/api/v1/admin/service-keys",
    "live-admin-api-keys-desktop-1280.png",
    "live-admin-api-keys-mobile-390.png",
    "Устройства",
    "/api/v1/device-bridges",
    "/api/v1/devices",
    "/api/v1/device-bridge-worker/status",
    "/api/v1/device-bridge-worker/production-readiness",
    "live-admin-devices-desktop-1280.png",
    "live-admin-devices-mobile-390.png",
    "Услуги",
    "/api/v1/admin/services",
    "Название услуги",
    "Создать услугу",
    "Редактирование услуги",
    "Сохранить услугу",
    "live-clinic-admin-services-desktop-1280.png",
    "live-clinic-admin-services-mobile-390.png",
    "Управление доступом",
    "/api/v1/patient-photo-protocol-release/governance",
    "Проверка хранения и сроков",
    "Блокировать окна без правил",
    "Закрыть окна без срока",
    "Закрыть временные коды",
    "Подготовить новую выдачу",
    "Подготовить ключ входа",
    "Отозвать истёкшие окна",
    "live-clinic-admin-governance-desktop-1280.png",
    "live-clinic-admin-governance-mobile-390.png",
    "Справка",
    "Поиск по разделам справки",
    "live-admin-help-desktop-1280.png",
    "live-admin-help-mobile-390.png",
  ],
  "e2e/production-doctor-workspace-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Рабочий стол",
    "Клиники и кабинеты",
    "Врачи и ассистенты",
    "Добавить врача",
    "/api/v1/admin/private-practices",
    "Создать кабинет и владельца",
    "Центр частной практики",
    "/api/v1/doctor/dashboard",
    "/api/v1/leads/appointments",
    "/api/v1/leads",
    "Краткое описание заявки",
    "Добавить заявку",
    "/api/v1/patients",
    "Новый пациент",
    "Создать пациента",
    "Сохранить изменения",
    "Архивировать",
    "live-doctor-desk-desktop-1280.png",
    "live-doctor-desk-mobile-390.png",
    "live-doctor-patients-desktop-1280.png",
    "live-doctor-patients-mobile-390.png",
    "Визиты",
    "Отчёты",
    "Поиск отчётов",
    "/report",
    "/report-package",
    "live-doctor-visits-desktop-1280.png",
    "live-doctor-visits-mobile-390.png",
    "live-doctor-reports-desktop-1280.png",
    "live-doctor-reports-mobile-390.png",
    "live-private-doctor-practice-desktop-1280.png",
    "live-private-doctor-practice-mobile-390.png",
  ],
  "src/pages/doctor/DoctorReportsPage.tsx": [
    "isProductionAppMode",
    "DoctorReportsPageDemo",
    "DoctorReportsPageLive",
  ],
  "src/pages/doctor/DoctorReportsPageLive.tsx": [
    "listSelfHostedVisits",
    "Источник данных: система клиники.",
    "Открыть отчёт в визите",
    "Поиск отчётов",
  ],
  "src/pages/admin/AdminServicesPage.tsx": [
    "isProductionAppMode",
    "AdminServicesPageLive",
    "AdminServicesPageDemo",
    "listAdminClinicServices",
    "createAdminClinicService",
    "updateAdminClinicService",
    "Рабочий режим: услуги сохраняются в базе клиники",
    "Создать услугу",
    "Редактирование услуги",
    "Сохранить услугу",
  ],
  "e2e/production-assistant-workspace-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Ассистент",
    "Захват фото",
    "Съёмка",
    "/api/v1/visits",
    "/assets",
    "Файл снимка",
    "Сохранить снимок",
    "Снимок сохранён в системе клиники",
    "live-assistant-capture-desktop-1280.png",
    "live-assistant-capture-mobile-390.png",
    "live-assistant-patients-desktop-1280.png",
  ],
  "e2e/production-rds3-import-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "Рабочее место · Ассистент",
    "Рабочее место · Дерматолог",
    "Съёмка",
    "Снимки",
    "Дерматоскопия · Прибор",
    "device_bridge",
    "/api/v1/visits/",
    "live-rds3-assistant-desktop-1280.png",
    "live-rds3-assistant-mobile-390.png",
    "live-rds3-doctor-desktop-1280.png",
    "live-rds3-doctor-mobile-390.png",
  ],
  "e2e/production-operator-workspace-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "mainLink",
    "sidebarLink",
    "sidebarLinks",
    "Консоль оператора",
    "Запросы на запись",
    "Сотрудники и доступ",
    "Создать сотрудника",
    "/api/v1/leads/appointments",
    "/api/v1/leads",
    "/api/v1/clinic/booking-requests",
    "/api/v1/integrations/booking-imports",
    "/api/v1/integrations/booking-imports/status",
    "/api/v1/clinic/available-slots",
    "Краткое описание заявки",
    "Создать заявку",
    "test.setTimeout(90_000)",
    "setupOperatorDialogFixture",
    "Карточка обращения",
    "Заметка клиники по обращению",
    "Сохранить заметку",
    "Заметка сохранена. Обращение взято в работу.",
    "Заметка обращения сохранена",
    "live-operator-dialog-audit-desktop-1280.png",
    "live-operator-console-desktop-1280.png",
    "live-operator-console-mobile-390.png",
    "live-operator-booking-requests-desktop-1280.png",
    "live-operator-booking-requests-mobile-390.png",
    "live-operator-dialog-desktop-1280.png",
    "live-operator-dialog-mobile-390.png",
  ],
  "e2e/production-patient-portal-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Личный кабинет",
    "История очагов",
    "Запись на приём",
    "Напоминания",
    "/api/v1/me/portal",
    "/api/v1/me/history",
    "/api/v1/me/booking-requests",
    "/api/v1/me/reminder-preferences",
    "/api/v1/me/follow-ups",
    "Причина запроса на запись",
    "Отправить запрос",
    "Сохранить настройки",
    "live-patient-home-desktop-1280.png",
    "live-patient-home-mobile-390.png",
    "live-patient-history-desktop-1280.png",
    "live-patient-booking-desktop-1280.png",
    "live-patient-booking-mobile-390.png",
    "live-patient-reminders-desktop-1280.png",
    "live-patient-reminders-mobile-390.png",
  ],
  "e2e/production-bot-booking-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "/bot-sim/miniapp/booking",
    "Помощник записи",
    "/api/v1/me/portal",
    "/api/v1/me/booking-requests",
    "Причина запроса на запись",
    "Отправить заявку",
    "live-bot-booking-desktop-1280.png",
    "live-bot-booking-mobile-390.png",
  ],
  "e2e/production-public-analysis-live.pw.ts": [
    "/analysis/",
    "/api/v1/public/analysis/",
    "Предварительная сводка",
    "Ссылка истекла",
    "Ссылка не найдена",
    "public_analysis_links",
    "token_hash",
    "validToken",
    "expiredToken",
    "missingToken",
    "live-public-analysis-valid-desktop-1280.png",
    "live-public-analysis-valid-mobile-390.png",
    "live-public-analysis-expired-desktop-1280.png",
    "live-public-analysis-missing-desktop-1280.png",
  ],
  "e2e/live-admin-test-helpers.ts": [
    "export function appMain(page: Page)",
    'return page.locator("main").first();',
    "export function mainText(page: Page, text: string | RegExp)",
    "return appMain(page).getByText(text).filter({ visible: true }).first();",
    "export function mainLink(page: Page, name: string | RegExp)",
    'return appMain(page).getByRole("link", options).filter({ visible: true }).first();',
    "export function bannerText(page: Page, text: string | RegExp)",
    'return page.getByRole("banner").getByText(text).filter({ visible: true }).first();',
    "export function pageHeaderText(page: Page, title: string, text: string | RegExp)",
    'page.getByRole("heading", { level: 1, name: title })',
    "export function sidebarLink(page: Page, name: string)",
    'data-sidebar="menu-button"',
    "export async function expectNoHorizontalOverflow(page: Page)",
    "export async function expectMainTapTargets(page: Page)",
    "HTMLInputElement",
    "label.getBoundingClientRect()",
    "isBrowserInternalControl",
    'getAttribute("aria-hidden") === "true"',
    "el.tabIndex < 0",
  ],
  "docs/backend/stage-4m-production-deployment-verification.md": [
    "Stage 4M",
    "npm run preflight:stage4m",
    "deploy:stage4m:first-boot:dry-run",
    "deploy:stage4m:post-deploy:dry-run",
    "deploy:stage4m:update:dry-run",
    "deploy:self-hosted:update",
    "update-production-status.json",
    "deploys/<run-id>",
    "staging",
    "dist/index.html",
    "retries",
    "deploy:stage4m:rollback-drill:dry-run",
    "ROLLBACK_TO_SELF_HOSTED_BACKUP",
    "e2e:admin-management:live",
    "I_CONFIRM_CREATE_TEST_CLINIC",
  ],
  "deploy/self-hosted/update-production.sh": [
    "flock -n",
    "stage4m-production-deploy-verify.mjs update",
    "BACKUP_ROOT",
    "SUMMARY_PATH",
    "RECEIPT_PATH",
    "LATEST_STATUS_PATH",
  ],
  "deploy/self-hosted/.env.production.example": [
    "VITE_APP_MODE=production",
    "VITE_SELF_HOSTED_API_BASE_URL=https://dermatolog.example.test",
  ],
  ".github/workflows/stage4m-production-deployment-verification.yml": [
    "name: stage4m-production-deployment-verification",
    "npm run preflight:stage4m",
    "deploy:stage4m:first-boot:dry-run",
    "deploy:stage4m:update:dry-run",
    "deploy:stage4m:rollback-drill:dry-run",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
];

const PROTECTED_RUNTIME_FILES = [
  "scripts/stage4m-production-deploy-verify.mjs",
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) errors.push(`${file} missing required text: ${text}`);
  }
}

function scanRuntimeCoupling(errors, root) {
  for (const file of PROTECTED_RUNTIME_FILES) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

export function validateLiveE2EContract(errors, root) {
  const markersAppearInOrder = (content, markers) => {
    let cursor = -1;
    for (const marker of markers) {
      cursor = content.indexOf(marker, cursor + 1);
      if (cursor === -1) return false;
    }
    return true;
  };
  const hasRequiredHelperImport = (content, requiredHelpers) => {
    const match = content.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/live-admin-test-helpers["'];?/s);
    if (!match) return false;
    return requiredHelpers.every((helper) => new RegExp(`\\b${helper}\\b`).test(match[1]));
  };
  const defaultRequiredHelpers = [
    "appMain",
    "bannerText",
    "mainText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
  ];
  const liveFiles = [
    {
      file: "e2e/production-auth-session-live.pw.ts",
      requiredHelpers: [
        "appMain",
        "bannerText",
        "mainText",
        "expectMainTapTargets",
        "expectNoHorizontalOverflow",
        "filterExpectedHttpStatusConsoleErrors",
      ],
      markers: [
        "Дерматолог Про — рабочий вход",
        "/api/v1/auth/login",
        "Неверная эл. почта или пароль.",
        "filterExpectedHttpStatusConsoleErrors",
        "Показать введённые символы",
        "Скрыть введённые символы",
        "missing-auth-",
        "Выйти из рабочей системы",
        "expired-live-test-token",
        "Сессия истекла",
        "Изменения сотрудников не сохраняются, пока вы не войдёте заново.",
        "Отключить доступ",
        "toBeDisabled()",
        "Войти заново",
        "live-auth-invalid-desktop-1280.png",
        "live-auth-invalid-mobile-390.png",
        "live-auth-active-desktop-1280.png",
        "live-auth-expired-desktop-1280.png",
        "live-auth-expired-mobile-390.png",
        "live-auth-login-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-admin-management-live.pw.ts",
      requiredHelpers: [...defaultRequiredHelpers, "filterExpectedHttpStatusConsoleErrors", "mainLink"],
      markers: [
        "Справка",
        "test.setTimeout(90_000)",
        "Создание сотрудника",
        "123456789",
        "Временный пароль должен быть не короче 10 символов.",
        "adminUserCreateRequestCount",
        "live-admin-users-validation-desktop-1280.png",
        "live-admin-users-validation-mobile-390.png",
        "ФИО ассистента",
        "Клиника ассистента",
        "Добавить ассистента",
        "Ассистент добавлен",
        "assistantCreateRequestsBeforeValidation",
        "Разделы сотрудников",
        "Учётная запись и роль — разные уровни доступа.",
        "Поиск сотрудников",
        "Фильтр доступа",
        "Приостановить роль врача",
        "accessDisableResponsePromise",
        "Доступ сотрудника отключён",
        "Вернуть доступ",
        "accessReactivateResponsePromise",
        "Доступ сотрудника возвращён",
        "live-clinic-admin-doctors-desktop-1280.png",
        "live-clinic-admin-doctors-mobile-390.png",
        "live-clinic-admin-assistants-desktop-1280.png",
        "live-clinic-admin-assistants-mobile-390.png",
        "live-clinic-admin-access-desktop-1280.png",
        "live-clinic-admin-access-mobile-390.png",
        "live-clinic-admin-password-desktop-1280.png",
        "live-clinic-admin-password-mobile-390.png",
        "Показать временный пароль врача",
        "Скрыть временный пароль врача",
        "Показать временный пароль ассистента",
        "Скрыть временный пароль ассистента",
        "clinicAdminDuplicateDoctorResponse",
        "duplicateDoctorConsoleErrorsStart",
        "filterExpectedHttpStatusConsoleErrors(duplicateDoctorConsoleErrors, 409, 1)",
        "Учётная запись с такой почтой уже существует.",
        "clinicAdminRecentAuditEvents",
        "Поиск по разделам справки",
        "Услуги",
        "/api/v1/admin/services",
        "Создать услугу",
        "Редактирование услуги",
        "Сохранить услугу",
        "live-clinic-admin-services-desktop-1280.png",
        "live-clinic-admin-services-mobile-390.png",
        "Управление доступом",
        "/api/v1/patient-photo-protocol-release/governance",
        "Проверка хранения и сроков",
        "Блокировать окна без правил",
        "Закрыть окна без срока",
        "Закрыть временные коды",
        "Подготовить новую выдачу",
        "Подготовить ключ входа",
        "Отозвать истёкшие окна",
        "live-clinic-admin-governance-desktop-1280.png",
        "live-clinic-admin-governance-mobile-390.png",
        "live-admin-help-desktop-1280.png",
        "live-admin-help-mobile-390.png",
        "Устройства",
        "/api/v1/device-bridges",
        "/api/v1/devices",
        "/api/v1/device-bridge-worker/status",
        "/api/v1/device-bridge-worker/production-readiness",
        "live-admin-devices-desktop-1280.png",
        "live-admin-devices-mobile-390.png",
        'getByLabel("Поиск аудита").fill(clinicName)',
        'getByLabel("Поиск событий доступа").fill(clinicName)',
      ],
    },
    {
      file: "e2e/production-doctor-workspace-live.pw.ts",
      requiredHelpers: defaultRequiredHelpers,
      markers: [
        "Рабочий стол",
        "Центр частной практики",
        "/api/v1/admin/private-practices",
        "/api/v1/doctor/dashboard",
        "/api/v1/leads/appointments",
        "/api/v1/patients",
        "Новый пациент",
        "Создать пациента",
        "Сохранить изменения",
        "Архивировать",
        "live-doctor-desk-desktop-1280.png",
        "live-doctor-desk-mobile-390.png",
        "live-doctor-patients-desktop-1280.png",
        "live-doctor-patients-mobile-390.png",
        "Визиты",
        "Отчёты",
        "Поиск отчётов",
        "/report",
        "/report-package",
        "live-doctor-visits-desktop-1280.png",
        "live-doctor-visits-mobile-390.png",
        "live-doctor-reports-desktop-1280.png",
        "live-doctor-reports-mobile-390.png",
        "live-private-doctor-practice-desktop-1280.png",
        "live-private-doctor-practice-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-assistant-workspace-live.pw.ts",
      requiredHelpers: defaultRequiredHelpers,
      markers: [
        "Ассистент",
        "Захват фото",
        "Съёмка",
        "/api/v1/visits",
        "/assets",
        "Файл снимка",
        "Сохранить снимок",
        "live-assistant-capture-desktop-1280.png",
        "live-assistant-capture-mobile-390.png",
        "live-assistant-patients-desktop-1280.png",
      ],
    },
    {
      file: "e2e/production-rds3-import-live.pw.ts",
      requiredHelpers: [
        "appMain",
        "bannerText",
        "mainText",
        "expectMainTapTargets",
        "expectNoHorizontalOverflow",
        "sidebarLink",
      ],
      markers: [
        "Рабочее место · Ассистент",
        "Рабочее место · Дерматолог",
        "Съёмка",
        "Снимки",
        "Дерматоскопия · Прибор",
        "device_bridge",
        "/api/v1/visits/",
        "live-rds3-assistant-desktop-1280.png",
        "live-rds3-assistant-mobile-390.png",
        "live-rds3-doctor-desktop-1280.png",
        "live-rds3-doctor-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-operator-workspace-live.pw.ts",
      requiredHelpers: [...defaultRequiredHelpers, "mainLink"],
      markers: [
        "Консоль оператора",
        "Запросы на запись",
        "/api/v1/leads/appointments",
        "/api/v1/leads",
        "/api/v1/clinic/booking-requests",
        "/api/v1/integrations/booking-imports",
        "/api/v1/integrations/booking-imports/status",
        "/api/v1/clinic/available-slots",
        "test.setTimeout(90_000)",
        "setupOperatorDialogFixture",
        "Карточка обращения",
        "Заметка клиники по обращению",
        "Сохранить заметку",
        "Заметка сохранена. Обращение взято в работу.",
        "Заметка обращения сохранена",
        "live-operator-dialog-audit-desktop-1280.png",
        "live-operator-console-desktop-1280.png",
        "live-operator-console-mobile-390.png",
        "live-operator-booking-requests-desktop-1280.png",
        "live-operator-booking-requests-mobile-390.png",
        "live-operator-dialog-desktop-1280.png",
        "live-operator-dialog-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-patient-portal-live.pw.ts",
      requiredHelpers: [...defaultRequiredHelpers, "filterExpectedHttpStatusConsoleErrors", "mainLink"],
      markers: [
        "Личный кабинет",
        "История очагов",
        "Заключения",
        "Заключение для пациента",
        "Запись на приём",
        "Напоминания",
        "filterExpectedHttpStatusConsoleErrors",
        "/api/v1/me/portal",
        "/api/v1/me/history",
        "/api/v1/me/reports/",
        "/api/v1/me/photo-protocols/",
        "/api/v1/me/booking-requests",
        "/api/v1/me/reminder-preferences",
        "/api/v1/me/follow-ups",
        "Причина запроса на запись",
        "Отправить запрос",
        "Сохранить настройки",
        "live-patient-home-desktop-1280.png",
        "live-patient-home-mobile-390.png",
        "live-patient-history-desktop-1280.png",
        "live-patient-reports-desktop-1280.png",
        "live-patient-report-detail-desktop-1280.png",
        "live-patient-report-detail-mobile-390.png",
        "live-patient-booking-desktop-1280.png",
        "live-patient-booking-mobile-390.png",
        "live-patient-reminders-desktop-1280.png",
        "live-patient-reminders-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-bot-booking-live.pw.ts",
      requiredHelpers: [
        "appMain",
        "bannerText",
        "mainText",
        "expectMainTapTargets",
        "expectNoHorizontalOverflow",
      ],
      markers: [
        "/bot-sim/miniapp/booking",
        "Помощник записи",
        "/api/v1/me/portal",
        "/api/v1/me/booking-requests",
        "Причина запроса на запись",
        "Отправить заявку",
        "live-bot-booking-desktop-1280.png",
        "live-bot-booking-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-public-analysis-live.pw.ts",
      requiredHelpers: [
        "appMain",
        "mainText",
        "expectMainTapTargets",
        "expectNoHorizontalOverflow",
      ],
      markers: [
        "/analysis/",
        "/api/v1/public/analysis/",
        "Предварительная сводка",
        "Ссылка истекла",
        "Ссылка не найдена",
        "public_analysis_links",
        "token_hash",
        "inserted_report as",
        "validToken",
        "expiredToken",
        "missingToken",
        "live-public-analysis-valid-desktop-1280.png",
        "live-public-analysis-valid-mobile-390.png",
        "live-public-analysis-expired-desktop-1280.png",
        "live-public-analysis-missing-desktop-1280.png",
      ],
    },
  ];

  for (const { file, markers, requiredHelpers } of liveFiles) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
      continue;
    }

    const content = read(root, file);
    if (!hasRequiredHelperImport(content, requiredHelpers)) {
      errors.push(`${file} must import live admin helpers from ./live-admin-test-helpers`);
    }
    for (const helperName of ["appMain", "bannerText", "mainLink", "mainText", "pageHeaderText", "sidebarLink", "expectNoHorizontalOverflow", "expectMainTapTargets"]) {
      const inlineHelperPattern = new RegExp(`(?:async\\s+)?function\\s+${helperName}\\s*\\(`);
      if (inlineHelperPattern.test(content)) {
        errors.push(`${file} defines inline live helper ${helperName}; import it from ./live-admin-test-helpers`);
      }
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes('page.locator("main")')) {
        errors.push(
          `${file}:${index + 1} uses ambiguous page.locator("main"); use appMain(page) for live safety scans`,
        );
      }
      if (/\.getByRole\(["']link["']/.test(line)) {
        errors.push(
          `${file}:${index + 1} uses direct getByRole("link"); use mainLink(page, ...) or sidebarLink(page, ...)`,
        );
      }
      if (/page\.getByText\(/.test(line)) {
        errors.push(
          `${file}:${index + 1} uses direct page.getByText; use mainText(page, ...), bannerText(page, ...), or a scoped locator`,
        );
      }
    });
    if (/\bcross join [^;\n]+;\s*\bcross join\b/i.test(content)) {
      errors.push(`${file} contains a semicolon before a following cross join; keep SQL fixture joins in one statement.`);
    }
    for (const text of markers) {
      if (!content.includes(text)) errors.push(`${file} missing live coverage marker: ${text}`);
    }
    if (
      file === "e2e/production-public-analysis-live.pw.ts" &&
      (content.includes("inserted_reports as") || content.includes("numbered_reports as"))
    ) {
      errors.push(
        `${file} must use one signed report plus multiple public_analysis_links; duplicate reports for one visit violate reports_visit_id_unique_idx`,
      );
    }
    if (
      file === "e2e/production-admin-management-live.pw.ts" &&
      content.includes("mainText(page, /Клиника создана|Сотрудник создан|Роль назначена/).first()")
    ) {
      errors.push(
        `${file} must search audit by the current run clinic before asserting created events; first-page audit assertions are order-dependent`,
      );
    }
    if (
      file === "e2e/production-admin-management-live.pw.ts" &&
      content.includes("auditEvents7d).toBe(clinicAdminRecentAuditEvents.length)")
    ) {
      errors.push(
        `${file} must not compare the analytics audit count with a separately queried recent-event list; concurrent audit writes make equality timing-dependent`,
      );
    }
    if (
      file === "e2e/production-admin-management-live.pw.ts" &&
      !markersAppearInOrder(content, [
        "const assistantsTab =",
        "assistantsTab.click()",
        'expect(assistantsTab).toHaveAttribute("aria-selected", "true")',
        'getByRole("heading", { name: "Ассистенты клиники" })',
        "live-clinic-admin-assistants-desktop-1280.png",
        "live-clinic-admin-assistants-mobile-390.png",
        "const doctorsTab =",
        "doctorsTab.click()",
        'expect(doctorsTab).toHaveAttribute("aria-selected", "true")',
        'getByRole("heading", { name: "Врачи клиники" })',
        "live-clinic-admin-doctors-desktop-1280.png",
        "live-clinic-admin-doctors-mobile-390.png",
        "const accessTab =",
        "accessTab.click()",
        'expect(accessTab).toHaveAttribute("aria-selected", "true")',
        'getByRole("heading", { name: "Управление доступом" })',
        "live-clinic-admin-access-desktop-1280.png",
        "live-clinic-admin-access-mobile-390.png",
      ])
    ) {
      errors.push(
        `${file} must select and verify each clinic staff tab before its desktop and mobile screenshots`,
      );
    }
  }
}

export function validateStage4MDbSmokeContract(errors, root) {
  const file = "scripts/stage4m-patient-portal-db-smoke.mjs";
  if (!existsSync(join(root, file))) return;
  const content = read(root, file);
  const repositoryFile = "backend/self-hosted/clinical-followup-repository.mjs";
  const repositoryContent = existsSync(join(root, repositoryFile)) ? read(root, repositoryFile) : "";
  for (const marker of [
    "fixture_patient_user_id uuid := gen_random_uuid();",
    "fixture_report_id uuid := gen_random_uuid();",
    "fixture_follow_up_id uuid := gen_random_uuid();",
  ]) {
    if (!content.includes(marker)) {
      errors.push(`${file} must generate transaction-local fixture UUIDs for patient portal smoke isolation`);
    }
  }
  if (/values\s*\(\s*['"]10000000-0000-4000-8000-000000000(?:111|181|211|311|411|511|611)['"]::uuid/i.test(content)) {
    errors.push(`${file} must not insert fixed Stage 4M fixture UUIDs; old production rows can collide with rollback smoke`);
  }
  if (!/const\s+followUpsSql\s*=\s*withoutTrailingSemicolon\(buildListPatientFollowUpsSql\(\{[\s\S]*?userId:\s*PATIENT_USER_ID_PLACEHOLDER[\s\S]*?\}\)\);/.test(content)) {
    errors.push(`${file} must execute the production patient follow-up JSON SQL directly`);
  }
  const patientListStart = repositoryContent.indexOf("export function buildListPatientFollowUpsSql");
  const patientListEnd = repositoryContent.indexOf("export function buildCreatePatientFollowUpMessageSql", patientListStart);
  const patientListContent = patientListStart >= 0
    ? repositoryContent.slice(patientListStart, patientListEnd >= 0 ? patientListEnd : undefined)
    : "";
  if (!/select\s+coalesce\(jsonb_agg\(row_to_json\(result\)\),\s*['"]\[\]['"]::jsonb\)::text\s+from\s+\(/i.test(patientListContent)) {
    errors.push(`${repositoryFile} patient follow-up list must return a JSON array for empty and populated results`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage4m"',
    '"check:stage4m"',
    '"preflight:stage4m"',
    '"deploy:stage4m:first-boot:dry-run"',
    '"deploy:stage4m:post-deploy:dry-run"',
    '"deploy:stage4m:backup-after-deploy:dry-run"',
    '"deploy:stage4m:update:dry-run"',
    '"deploy:stage4m:status"',
    '"smoke:stage4m:admin-db"',
    '"smoke:stage4m:admin-governance-db"',
    '"smoke:stage4m:admin-api"',
    '"e2e:admin-management:live"',
    '"e2e:auth-session:live"',
    '"e2e:doctor-workspace:live"',
    '"e2e:assistant-workspace:live"',
    '"e2e:operator-workspace:live"',
    '"e2e:patient-portal:live"',
    '"e2e:bot-booking:live"',
    '"e2e:public-analysis:live"',
    '"deploy:self-hosted:update"',
    '"deploy:stage4m:rollback-drill:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4M production deployment verification preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4M production deployment verification preflight");
  }
}

export function collectStage4MChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  scanRuntimeCoupling(errors, root);
  validateLiveE2EContract(errors, root);
  validateStage4MDbSmokeContract(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage4MChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4m-production-deploy] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4m-production-deploy] OK (${result.checkedFiles} files, production deploy verification guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
