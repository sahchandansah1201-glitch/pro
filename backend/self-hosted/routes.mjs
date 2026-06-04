import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
} from "./api-response.mjs";
import { createAuthRepository } from "./auth-repository.mjs";
import { createAuthService } from "./auth-service.mjs";
import {
  createAuditRepository,
  recordAuditBestEffort,
} from "./audit-repository.mjs";
import {
  dependencyStatus,
  publicConfig,
} from "./config.mjs";
import { createPostgresClient, DatabaseConfigError } from "./db-client.mjs";
import { createDeviceBridgeCommandRepository } from "./device-bridge-command-repository.mjs";
import { createDeviceBridgeCommandService } from "./device-bridge-command-service.mjs";
import { createDeviceBridgeFleetReliabilityService } from "./device-bridge-fleet-reliability-service.mjs";
import { createDeviceBridgeLifecycleAssuranceService } from "./device-bridge-lifecycle-assurance-service.mjs";
import { createDeviceBridgeOperationsContinuityService } from "./device-bridge-operations-continuity-service.mjs";
import { createDeviceBridgeProductionReadinessService } from "./device-bridge-production-readiness-service.mjs";
import { createDeviceBridgeWorkerRepository } from "./device-bridge-worker-repository.mjs";
import { createDeviceBridgeWorkerService } from "./device-bridge-worker-service.mjs";
import {
  createDeviceRegistryRepository,
  parseDeviceRegistryParams,
} from "./device-registry-repository.mjs";
import { createDoctorDashboardRepository } from "./doctor-dashboard-repository.mjs";
import { createDoctorDashboardService } from "./doctor-dashboard-service.mjs";
import {
  createLeadsAppointmentsRepository,
  normalizeLeadsAppointmentsParams,
} from "./leads-appointments-repository.mjs";
import { createLeadsAppointmentsService } from "./leads-appointments-service.mjs";
import { createLeadsAppointmentsWriteRepository } from "./leads-appointments-write-repository.mjs";
import { createLeadsAppointmentsWriteService } from "./leads-appointments-write-service.mjs";
import {
  createPatientRepository,
  parsePatientListParams,
} from "./patients-repository.mjs";
import {
  assertUuid,
  createPatientWriteService,
} from "./patient-write-service.mjs";
import { createPatientPortalRepository } from "./patient-portal-repository.mjs";
import { createPatientPortalService } from "./patient-portal-service.mjs";
import { createPatientPhotoProtocolDeliveryRepository } from "./patient-photo-protocol-delivery-repository.mjs";
import { createPatientPhotoProtocolDeliveryService } from "./patient-photo-protocol-delivery-service.mjs";
import { createAssetWriteRepository } from "./asset-write-repository.mjs";
import {
  createAssetWriteService,
  normalizeDownloadUrlParams,
} from "./asset-write-service.mjs";
import { createClinicalWorkspaceRepository } from "./clinical-workspace-repository.mjs";
import { createClinicalWorkspaceService } from "./clinical-workspace-service.mjs";
import { createClinicalReportPackageRepository } from "./clinical-report-package-repository.mjs";
import { createClinicalReportPackageService } from "./clinical-report-package-service.mjs";
import { createPatientPhotoProtocolReleaseRepository } from "./patient-photo-protocol-release-repository.mjs";
import { createPatientPhotoProtocolReleaseService } from "./patient-photo-protocol-release-service.mjs";
import {
  createClinicalFollowUpRepository,
  normalizeClinicalFollowUpOperationsParams,
  normalizeClinicalFollowUpParams,
  normalizeClinicalFollowUpSopPolicyTemplateParams,
} from "./clinical-followup-repository.mjs";
import { createClinicalFollowUpService } from "./clinical-followup-service.mjs";
import {
  createClinicBookingRequestsRepository,
  normalizeClinicBookingRequestParams,
} from "./clinic-booking-requests-repository.mjs";
import { createClinicBookingRequestsService } from "./clinic-booking-requests-service.mjs";
import {
  createClinicAvailableSlotsRepository,
  normalizeClinicAvailableSlotParams,
} from "./clinic-available-slots-repository.mjs";
import { createClinicAvailableSlotsService } from "./clinic-available-slots-service.mjs";
import {
  createExternalIntakeImportRepository,
  normalizeExternalIntakeImportParams,
  normalizeExternalIntakeStatusParams,
} from "./external-intake-import-repository.mjs";
import { createExternalIntakeImportService } from "./external-intake-import-service.mjs";
import { createLocalObjectStore } from "./object-store.mjs";
import { extractCorrelationId, safeRequestPath } from "./ops-logger.mjs";
import { collectSelfHostedOpsRuntimeChecks } from "./ops-runtime-checks.mjs";
import { buildSelfHostedProductReadiness } from "./product-readiness.mjs";
import { deviceReadScope, opsStatusScope, patientReadScope, visitReadScope } from "./rbac.mjs";
import { createVisitWorkspaceRepository } from "./visit-workspace-repository.mjs";
import { createVisitWorkspaceWriteRepository } from "./visit-workspace-write-repository.mjs";
import { createVisitWorkspaceWriteService } from "./visit-workspace-write-service.mjs";
import {
  createVisitScheduleRepository,
  normalizeVisitScheduleParams,
} from "./visit-schedule-repository.mjs";
import { createVisitScheduleService } from "./visit-schedule-service.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OPENAPI_4A = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4a.json"), "utf8"),
);
const OPENAPI_4B = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4b.json"), "utf8"),
);
const OPENAPI_4C = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4c.json"), "utf8"),
);
const OPENAPI_4D = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4d.json"), "utf8"),
);
const OPENAPI_4G = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4g.json"), "utf8"),
);
const OPENAPI_4H = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4h.json"), "utf8"),
);
const OPENAPI_4I = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4i.json"), "utf8"),
);
const OPENAPI_4J = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4j.json"), "utf8"),
);
const OPENAPI_4N = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4n.json"), "utf8"),
);
const OPENAPI_4P = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4p.json"), "utf8"),
);
const OPENAPI_4Q = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4q.json"), "utf8"),
);
const OPENAPI_4R = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4r.json"), "utf8"),
);
const OPENAPI_4S = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4s.json"), "utf8"),
);
const OPENAPI_4U = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4u.json"), "utf8"),
);
const OPENAPI_4V = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4v.json"), "utf8"),
);
const OPENAPI_4W = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4w.json"), "utf8"),
);
const OPENAPI_4X = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4x.json"), "utf8"),
);
const OPENAPI_4Y = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4y.json"), "utf8"),
);
const OPENAPI_4Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4z.json"), "utf8"),
);
const OPENAPI_5H = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5h.json"), "utf8"),
);
const OPENAPI_5I = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5i.json"), "utf8"),
);
const OPENAPI_5J = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5j.json"), "utf8"),
);
const OPENAPI_5K = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5k.json"), "utf8"),
);
const OPENAPI_5L = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5l.json"), "utf8"),
);
const OPENAPI_5N = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5n.json"), "utf8"),
);
const OPENAPI_5O = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5o.json"), "utf8"),
);
const OPENAPI_5P = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5p.json"), "utf8"),
);
const OPENAPI_5Q = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5q.json"), "utf8"),
);
const OPENAPI_5R = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5r.json"), "utf8"),
);
const OPENAPI_5S = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5s.json"), "utf8"),
);
const OPENAPI_5T = JSON.parse(
  readFileSync(join(HERE, "openapi.stage5t.json"), "utf8"),
);
const OPENAPI_8G_8I = JSON.parse(
  readFileSync(join(HERE, "openapi.stage8g-8i.json"), "utf8"),
);
const OPENAPI_8J_8O = JSON.parse(
  readFileSync(join(HERE, "openapi.stage8j-8o.json"), "utf8"),
);
const OPENAPI_8P_9A = JSON.parse(
  readFileSync(join(HERE, "openapi.stage8p-9a.json"), "utf8"),
);
const OPENAPI_9B_9M = JSON.parse(
  readFileSync(join(HERE, "openapi.stage9b-9m.json"), "utf8"),
);
const OPENAPI_9N_9Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage9n-9z.json"), "utf8"),
);
const OPENAPI_17A_17Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage17a-17z.json"), "utf8"),
);
const OPENAPI_18A_18Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage18a-18z.json"), "utf8"),
);
const OPENAPI_19A_19Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage19a-19z.json"), "utf8"),
);
const OPENAPI_20A_20Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage20a-20z.json"), "utf8"),
);
const OPENAPI_21A_21Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage21a-21z.json"), "utf8"),
);
const OPENAPI_22A_22Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage22a-22z.json"), "utf8"),
);
const OPENAPI_23A_23Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage23a-23z.json"), "utf8"),
);
const OPENAPI_24A_24Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage24a-24z.json"), "utf8"),
);
const OPENAPI_25A_25Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage25a-25z.json"), "utf8"),
);
const OPENAPI_26A_26Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage26a-26z.json"), "utf8"),
);
const OPENAPI_27A_27Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage27a-27z.json"), "utf8"),
);
const OPENAPI_28A_28Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage28a-28z.json"), "utf8"),
);
const OPENAPI_29A_29Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage29a-29z.json"), "utf8"),
);
const OPENAPI_30A_30Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage30a-30z.json"), "utf8"),
);
const OPENAPI_31A_31Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage31a-31z.json"), "utf8"),
);
const OPENAPI_32A_32Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage32a-32z.json"), "utf8"),
);
const OPENAPI_33A_33Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage33a-33z.json"), "utf8"),
);
const OPENAPI_34A_34Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage34a-34z.json"), "utf8"),
);
const OPENAPI_35A_35Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage35a-35z.json"), "utf8"),
);
const OPENAPI_36A_36Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage36a-36z.json"), "utf8"),
);
const OPENAPI_37A_37Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage37a-37z.json"), "utf8"),
);
const OPENAPI_38A_38Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage38a-38z.json"), "utf8"),
);
const OPENAPI_39A_39Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage39a-39z.json"), "utf8"),
);
const OPENAPI_40A_40Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage40a-40z.json"), "utf8"),
);
const OPENAPI_41A_41Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage41a-41z.json"), "utf8"),
);
const OPENAPI_42A_42Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage42a-42z.json"), "utf8"),
);
const OPENAPI_43A_43Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage43a-43z.json"), "utf8"),
);
const OPENAPI_44A_44Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage44a-44z.json"), "utf8"),
);
const OPENAPI_45A_45Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage45a-45z.json"), "utf8"),
);
const OPENAPI_46A_46Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage46a-46z.json"), "utf8"),
);
const OPENAPI_47A_47Z = JSON.parse(
  readFileSync(join(HERE, "openapi.stage47a-47z.json"), "utf8"),
);

const LARGE_JSON_BODY_LIMIT_BYTES = 40 * 1024 * 1024;

function getRuntime(config, runtime = {}) {
  const dbClient = runtime.dbClient || createPostgresClient(config);
  const auditRepository = runtime.auditRepository || createAuditRepository(dbClient);
  const authRepository = runtime.authRepository || createAuthRepository(dbClient);
  const authService =
    runtime.authService ||
    createAuthService({
      config,
      authRepository,
      auditRepository,
    });
  const patientRepository =
    runtime.patientRepository || createPatientRepository(dbClient);
  const deviceRegistryRepository =
    runtime.deviceRegistryRepository || createDeviceRegistryRepository(dbClient);
  const deviceBridgeCommandRepository =
    runtime.deviceBridgeCommandRepository || createDeviceBridgeCommandRepository(dbClient);
  const deviceBridgeCommandService =
    runtime.deviceBridgeCommandService ||
    createDeviceBridgeCommandService({
      deviceBridgeCommandRepository,
      auditRepository,
    });
  const deviceBridgeWorkerRepository =
    runtime.deviceBridgeWorkerRepository || createDeviceBridgeWorkerRepository(dbClient);
  const deviceBridgeWorkerService =
    runtime.deviceBridgeWorkerService ||
    createDeviceBridgeWorkerService({
      config,
      deviceBridgeWorkerRepository,
      auditRepository,
    });
  const deviceBridgeProductionReadinessService =
    runtime.deviceBridgeProductionReadinessService ||
    createDeviceBridgeProductionReadinessService({
      deviceBridgeWorkerService,
      auditRepository,
    });
  const deviceBridgeOperationsContinuityService =
    runtime.deviceBridgeOperationsContinuityService ||
    createDeviceBridgeOperationsContinuityService({
      deviceBridgeProductionReadinessService,
      auditRepository,
    });
  const deviceBridgeFleetReliabilityService =
    runtime.deviceBridgeFleetReliabilityService ||
    createDeviceBridgeFleetReliabilityService({
      deviceBridgeOperationsContinuityService,
      auditRepository,
    });
  const deviceBridgeLifecycleAssuranceService =
    runtime.deviceBridgeLifecycleAssuranceService ||
    createDeviceBridgeLifecycleAssuranceService({
      deviceBridgeFleetReliabilityService,
      auditRepository,
    });
  const doctorDashboardRepository =
    runtime.doctorDashboardRepository || createDoctorDashboardRepository(dbClient);
  const doctorDashboardService =
    runtime.doctorDashboardService ||
    createDoctorDashboardService({
      doctorDashboardRepository,
      auditRepository,
    });
  const visitScheduleRepository =
    runtime.visitScheduleRepository || createVisitScheduleRepository(dbClient);
  const visitScheduleService =
    runtime.visitScheduleService ||
    createVisitScheduleService({
      visitScheduleRepository,
      auditRepository,
    });
  const leadsAppointmentsRepository =
    runtime.leadsAppointmentsRepository || createLeadsAppointmentsRepository(dbClient);
  const leadsAppointmentsService =
    runtime.leadsAppointmentsService ||
    createLeadsAppointmentsService({
      leadsAppointmentsRepository,
      auditRepository,
    });
  const leadsAppointmentsWriteRepository =
    runtime.leadsAppointmentsWriteRepository || createLeadsAppointmentsWriteRepository(dbClient);
  const leadsAppointmentsWriteService =
    runtime.leadsAppointmentsWriteService ||
    createLeadsAppointmentsWriteService({
      leadsAppointmentsWriteRepository,
      auditRepository,
    });
  const clinicBookingRequestsRepository =
    runtime.clinicBookingRequestsRepository || createClinicBookingRequestsRepository(dbClient);
  const clinicBookingRequestsService =
    runtime.clinicBookingRequestsService ||
    createClinicBookingRequestsService({
      clinicBookingRequestsRepository,
      auditRepository,
    });
  const clinicAvailableSlotsRepository =
    runtime.clinicAvailableSlotsRepository || createClinicAvailableSlotsRepository(dbClient);
  const clinicAvailableSlotsService =
    runtime.clinicAvailableSlotsService ||
    createClinicAvailableSlotsService({
      clinicAvailableSlotsRepository,
      auditRepository,
    });
  const externalIntakeImportRepository =
    runtime.externalIntakeImportRepository || createExternalIntakeImportRepository(dbClient);
  const externalIntakeImportService =
    runtime.externalIntakeImportService ||
    createExternalIntakeImportService({
      externalIntakeImportRepository,
      auditRepository,
    });
  const patientWriteService =
    runtime.patientWriteService ||
    createPatientWriteService({
      patientRepository,
      auditRepository,
    });
  const objectStore = runtime.objectStore || createLocalObjectStore(config);
  const patientPortalRepository =
    runtime.patientPortalRepository || createPatientPortalRepository(dbClient);
  const patientPortalService =
    runtime.patientPortalService ||
    createPatientPortalService({
      patientPortalRepository,
      auditRepository,
    });
  const patientPhotoProtocolDeliveryRepository =
    runtime.patientPhotoProtocolDeliveryRepository || createPatientPhotoProtocolDeliveryRepository(dbClient);
  const patientPhotoProtocolDeliveryService =
    runtime.patientPhotoProtocolDeliveryService ||
    createPatientPhotoProtocolDeliveryService({
      patientPhotoProtocolDeliveryRepository,
      objectStore,
      auditRepository,
    });
  const visitWorkspaceRepository =
    runtime.visitWorkspaceRepository || createVisitWorkspaceRepository(dbClient);
  const visitWorkspaceWriteRepository =
    runtime.visitWorkspaceWriteRepository || createVisitWorkspaceWriteRepository(dbClient);
  const visitWorkspaceWriteService =
    runtime.visitWorkspaceWriteService ||
    createVisitWorkspaceWriteService({
      visitWorkspaceRepository,
      visitWorkspaceWriteRepository,
      auditRepository,
    });
  const clinicalWorkspaceRepository =
    runtime.clinicalWorkspaceRepository || createClinicalWorkspaceRepository(dbClient);
  const clinicalWorkspaceService =
    runtime.clinicalWorkspaceService ||
    createClinicalWorkspaceService({
      visitWorkspaceRepository,
      clinicalWorkspaceRepository,
      auditRepository,
      objectStore,
    });
  const clinicalReportPackageRepository =
    runtime.clinicalReportPackageRepository || createClinicalReportPackageRepository(dbClient);
  const clinicalReportPackageService =
    runtime.clinicalReportPackageService ||
    createClinicalReportPackageService({
      clinicalReportPackageRepository,
      auditRepository,
    });
  const patientPhotoProtocolReleaseRepository =
    runtime.patientPhotoProtocolReleaseRepository || createPatientPhotoProtocolReleaseRepository(dbClient);
  const patientPhotoProtocolReleaseService =
    runtime.patientPhotoProtocolReleaseService ||
    createPatientPhotoProtocolReleaseService({
      patientPhotoProtocolReleaseRepository,
      auditRepository,
    });
  const clinicalFollowUpRepository =
    runtime.clinicalFollowUpRepository || createClinicalFollowUpRepository(dbClient);
  const clinicalFollowUpService =
    runtime.clinicalFollowUpService ||
    createClinicalFollowUpService({
      clinicalFollowUpRepository,
      auditRepository,
    });
  const assetWriteRepository =
    runtime.assetWriteRepository || createAssetWriteRepository(dbClient);
  const assetWriteService =
    runtime.assetWriteService ||
    createAssetWriteService({
      config,
      visitWorkspaceRepository,
      assetWriteRepository,
      auditRepository,
      objectStore,
    });
  return {
    assetWriteRepository,
    assetWriteService,
    auditRepository,
    authRepository,
    authService,
    clinicalReportPackageRepository,
    clinicalReportPackageService,
    clinicalFollowUpRepository,
    clinicalFollowUpService,
    clinicalWorkspaceRepository,
    clinicalWorkspaceService,
    clinicAvailableSlotsRepository,
    clinicAvailableSlotsService,
    clinicBookingRequestsRepository,
    clinicBookingRequestsService,
    dbClient,
    deviceBridgeCommandRepository,
    deviceBridgeCommandService,
    deviceBridgeFleetReliabilityService,
    deviceBridgeLifecycleAssuranceService,
    deviceBridgeOperationsContinuityService,
    deviceBridgeProductionReadinessService,
    deviceBridgeWorkerRepository,
    deviceBridgeWorkerService,
    doctorDashboardRepository,
    doctorDashboardService,
    externalIntakeImportRepository,
    externalIntakeImportService,
    leadsAppointmentsRepository,
    leadsAppointmentsService,
    leadsAppointmentsWriteRepository,
    leadsAppointmentsWriteService,
    visitScheduleRepository,
    visitScheduleService,
    deviceRegistryRepository,
    patientRepository,
    patientPortalRepository,
    patientPortalService,
    patientPhotoProtocolDeliveryRepository,
    patientPhotoProtocolDeliveryService,
    patientPhotoProtocolReleaseRepository,
    patientPhotoProtocolReleaseService,
    patientWriteService,
    visitWorkspaceRepository,
    visitWorkspaceWriteRepository,
    visitWorkspaceWriteService,
  };
}

async function runtimeReadiness(config, dbClient) {
  const dependencies = dependencyStatus(config).map((dependency) => ({
    ...dependency,
    connected: false,
    status: dependency.configured ? "configured" : "missing",
  }));
  const postgres = dependencies.find((item) => item.name === "postgres");

  if (postgres?.configured) {
    try {
      const check = await dbClient.checkConnection();
      postgres.connected = Boolean(check.connected);
      postgres.status = postgres.connected ? "connected" : "unavailable";
      postgres.detail = check.detail || postgres.detail;
    } catch {
      postgres.connected = false;
      postgres.status = "unavailable";
      postgres.detail = "PostgreSQL connection failed";
    }
  }

  const ready = dependencies.every((item) => {
    if (item.name === "postgres") return item.configured && item.connected;
    return item.configured;
  });

  return {
    ready,
    status: ready ? "ready" : "degraded",
    dependencies,
  };
}

function publicErrorFor(error) {
  const messages = {
    auth_not_configured: "Authentication is not configured for the self-hosted backend.",
    auth_required: "Authentication is required for this endpoint.",
    invalid_json: "Request body must be valid JSON.",
    database_not_configured: "Database is not configured for the self-hosted backend.",
    database_unavailable: "Database is unavailable for the self-hosted backend.",
    forbidden: "The authenticated user does not have access to this resource.",
    invalid_credentials: "Invalid credentials.",
    invalid_token: "Invalid or expired authorization token.",
    worker_auth_required: "Device Bridge worker authentication is required.",
    worker_token_invalid: "Device Bridge worker token is invalid.",
    worker_token_not_configured: "Device Bridge worker token is not configured for this backend.",
    asset_binary_not_found: "Asset binary was not found in the self-hosted object store.",
    asset_not_found: "Asset was not found in the allowed clinic scope.",
    object_storage_unavailable: "Object storage is unavailable for the self-hosted backend.",
    patient_not_found: "Patient was not found in the allowed clinic scope.",
    lead_not_found: "Lead was not found in the allowed clinic scope.",
    visit_not_found: "Visit was not found in the allowed clinic scope.",
    lesion_not_found: "Lesion was not found in the allowed clinic scope.",
    command_not_found: "Device Bridge command was not found for this worker bridge.",
    not_found: "Resource was not found in the allowed clinic scope.",
    invalid_uuid: "The supplied identifier is not a valid UUID.",
    validation_error: "Request payload failed validation.",
    photo_protocol_access_credential_invalid: "Patient photo protocol access was not confirmed.",
    photo_protocol_access_not_found: "Patient photo protocol access was not found.",
    photo_protocol_access_revoked: "Patient photo protocol access was revoked.",
    photo_protocol_access_expired: "Patient photo protocol access expired.",
    photo_protocol_access_retention_required: "Patient photo protocol access retention policy is not approved.",
    photo_protocol_access_policy_blocked: "Patient photo protocol access policy is blocked.",
    photo_protocol_access_proxy_disabled: "Patient photo protocol access proxy is not enabled.",
    photo_protocol_access_consent_missing: "Patient photo protocol access consent is missing.",
    photo_protocol_access_not_prepared: "Patient photo protocol access is not prepared.",
    photo_protocol_access_not_configured: "Patient photo protocol access exchange is not configured.",
    photo_protocol_session_required: "Patient photo protocol session cookie is required.",
    photo_protocol_session_invalid: "Patient photo protocol session cookie is invalid or expired.",
    photo_protocol_session_not_configured: "Patient photo protocol session validation is not configured.",
  };
  if (error instanceof DatabaseConfigError || error?.publicCode) {
    const code = error.publicCode || "database_unavailable";
    return {
      status: error.publicStatus || 503,
      code,
      message: messages[code] || error.message || "The self-hosted backend could not complete the request.",
      details: error.publicDetails,
    };
  }

  return {
    status: 500,
    code: "internal_error",
    message: "The self-hosted backend could not complete the request.",
  };
}

function parseJsonBody(body) {
  if (body == null || body === "") return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(String(body));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.publicCode = "invalid_json";
    error.publicStatus = 400;
    throw error;
  }
}

function safeContentDispositionFileName(asset) {
  const ext = String(asset?.contentType || "").includes("png")
    ? "png"
    : String(asset?.contentType || "").includes("jpeg") || String(asset?.contentType || "").includes("jpg")
      ? "jpg"
      : String(asset?.contentType || "").includes("webp")
        ? "webp"
        : String(asset?.contentType || "").includes("pdf")
          ? "pdf"
          : "bin";
  return `asset-${String(asset?.id || "download").slice(0, 8)}.${ext}`;
}

function binaryResponse(status, { body, contentType, fileName, correlationId }, config, requestOrigin) {
  return {
    status,
    headers: {
      ...corsHeaders(config, requestOrigin),
      "content-type": contentType || "application/octet-stream",
      "content-length": String(body?.byteLength ?? 0),
      "cache-control": "no-store",
      "content-disposition": `inline; filename="${fileName || "asset.bin"}"`,
      "x-correlation-id": correlationId,
    },
    body,
  };
}

function serializeHttpOnlyCookie(cookie) {
  if (!cookie || typeof cookie !== "object") return null;
  const name = String(cookie.name || "");
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return null;
  const value = String(cookie.value || "").replace(/[^A-Za-z0-9._~-]/g, "");
  if (!value) return null;
  const path = String(cookie.path || "/").replace(/[;\r\n]/g, "");
  const maxAge = Math.max(0, Math.min(Number(cookie.maxAgeSeconds ?? 0) || 0, 60 * 60 * 24));
  const sameSite = cookie.sameSite === "Lax" ? "Lax" : "Strict";
  return `${name}=${value}; Max-Age=${maxAge}; Path=${path}; HttpOnly; Secure; SameSite=${sameSite}`;
}

function readCookieValue(headers, name) {
  const cookieHeader = String(headers?.cookie || headers?.Cookie || "");
  const safeName = String(name || "");
  if (!cookieHeader || !safeName) return "";
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === safeName) {
      return rawValue.join("=").replace(/[^A-Za-z0-9._~-]/g, "");
    }
  }
  return "";
}

function patientIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/patients\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function handleSelfHostedRequest(
  request,
  config,
  now = () => new Date().toISOString(),
  runtime = {},
) {
  const method = String(request.method || "GET").toUpperCase();
  const url = new URL(request.url || "/", "http://self-hosted.local");
  const requestOrigin = request.headers?.origin || "";
  const runtimeServices = getRuntime(config, runtime);
  const correlationId =
    request.headers?.["x-correlation-id"] ||
    request.headers?.["X-Correlation-Id"] ||
    "stage4i-local";

  if (method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders(config, requestOrigin),
      body: "",
    };
  }

  if (url.pathname === "/api/v1/auth/login" && method === "POST") {
    try {
      const login = await runtimeServices.authService.login(parseJsonBody(request.body), {
        correlationId,
      });
      return jsonResponse(
        200,
        {
          stage: "4D",
          ...login,
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/patients" && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientWriteService.createPatient(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "4D",
          source: "postgres",
          item: result.patient,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  const patientId = patientIdFromPath(url.pathname);
  if (patientId) {
    if (method === "GET") {
      try {
        const safePatientId = assertUuid(patientId);
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const scope = patientReadScope(authContext);
        const patient = await runtimeServices.patientRepository.getPatient({
          patientId: safePatientId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
        if (!patient) {
          return errorResponse({
            status: 404,
            code: "patient_not_found",
            message: "Patient was not found in the allowed clinic scope.",
            correlationId,
            config,
            requestOrigin,
          });
        }
        await recordAuditBestEffort(
          runtimeServices.auditRepository,
          {
            clinicId: patient.clinic.id || null,
            actorUserId: authContext.userId,
            action: "patient.read",
            entityType: "patient",
            entityId: patient.id,
            correlationId,
            metadata: {
              allClinics: scope.allClinics,
            },
          },
        );
        return jsonResponse(
          200,
          {
            stage: "4D",
            source: "postgres",
            item: patient,
            auth: {
              userId: authContext.userId,
              roles: authContext.roles,
              allClinics: scope.allClinics,
            },
            generatedAt: now(),
            correlationId,
          },
          config,
          requestOrigin,
        );
      } catch (error) {
        const publicError = publicErrorFor(error);
        return errorResponse({
          ...publicError,
          correlationId,
          config,
          requestOrigin,
        });
      }
    }

    if (method === "PATCH") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const result = await runtimeServices.patientWriteService.updatePatient(
          patientId,
          parseJsonBody(request.body),
          authContext,
          { correlationId },
        );
        return jsonResponse(
          200,
          {
            stage: "4D",
            source: "postgres",
            item: result.patient,
            auth: {
              userId: authContext.userId,
              roles: authContext.roles,
              allClinics: result.scope.allClinics,
            },
            generatedAt: now(),
            correlationId,
          },
          config,
          requestOrigin,
        );
      } catch (error) {
        const publicError = publicErrorFor(error);
        return errorResponse({
          ...publicError,
          correlationId,
          config,
          requestOrigin,
        });
      }
    }

    if (method === "DELETE") {
      try {
        const authContext = await runtimeServices.authService.authenticate(request.headers);
        const result = await runtimeServices.patientWriteService.archivePatient(
          patientId,
          parseJsonBody(request.body),
          authContext,
          { correlationId },
        );
        return jsonResponse(
          200,
          {
            stage: "4D",
            source: "postgres",
            archived: true,
            item: result.patient,
            auth: {
              userId: authContext.userId,
              roles: authContext.roles,
              allClinics: result.scope.allClinics,
            },
            generatedAt: now(),
            correlationId,
          },
          config,
          requestOrigin,
        );
      } catch (error) {
        const publicError = publicErrorFor(error);
        return errorResponse({
          ...publicError,
          correlationId,
          config,
          requestOrigin,
        });
      }
    }
  }

  // Stage 5J · production visit schedule contract.
  if (url.pathname === "/api/v1/visits" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.visitScheduleService.listVisits(
        authContext,
        normalizeVisitScheduleParams(url.searchParams),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5J",
          source: "postgres",
          items: result.schedule.items,
          count: result.schedule.count,
          limit: result.schedule.limit,
          offset: result.schedule.offset,
          filters: result.schedule.filters,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5K · production leads/appointments contract.
  if (url.pathname === "/api/v1/leads/appointments" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.leadsAppointmentsService.getOverview(
        authContext,
        normalizeLeadsAppointmentsParams(url.searchParams),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5K",
          source: "postgres",
          kpis: result.overview.kpis,
          leads: result.overview.leads,
          appointments: result.overview.appointments,
          filters: result.overview.filters,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5L · production leads/appointments write contract.
  if (url.pathname === "/api/v1/leads" && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.leadsAppointmentsWriteService.createLead(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "5L",
          source: "postgres",
          item: result.lead,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const leadMatch = url.pathname.match(/^\/api\/v1\/leads\/([^/]+)$/);
  if (leadMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.leadsAppointmentsWriteService.updateLeadStatus(
        decodeURIComponent(leadMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5L",
          source: "postgres",
          item: result.lead,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const leadBookMatch = url.pathname.match(/^\/api\/v1\/leads\/([^/]+)\/book-appointment$/);
  if (leadBookMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.leadsAppointmentsWriteService.bookLeadAppointment(
        decodeURIComponent(leadBookMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "5L",
          source: "postgres",
          item: result.lead,
          appointment: result.appointment,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5P · clinic booking requests intake. Patient-originated booking
  // requests are reviewed inside the self-hosted backend; no external CRM/feed
  // is called from this runtime path.
  if (url.pathname === "/api/v1/clinic/booking-requests" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicBookingRequestsService.listBookingRequests(
        authContext,
        normalizeClinicBookingRequestParams(url.searchParams),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5P",
          source: "postgres",
          items: result.queue.items,
          count: result.queue.count,
          limit: result.queue.limit,
          offset: result.queue.offset,
          filters: result.queue.filters,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicBookingSlotMatch = url.pathname.match(/^\/api\/v1\/clinic\/booking-requests\/([^/]+)\/book-from-slot$/);
  if (clinicBookingSlotMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const requestId = decodeURIComponent(clinicBookingSlotMatch[1]);
      const result = await runtimeServices.clinicBookingRequestsService.bookBookingRequestFromSlot(
        requestId,
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5S",
          source: "postgres",
          item: result.bookingRequest,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicBookingRequestMatch = url.pathname.match(/^\/api\/v1\/clinic\/booking-requests\/([^/]+)$/);
  if (clinicBookingRequestMatch && (method === "GET" || method === "PATCH")) {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const requestId = decodeURIComponent(clinicBookingRequestMatch[1]);
      const result = method === "GET"
        ? await runtimeServices.clinicBookingRequestsService.getBookingRequest(
            requestId,
            authContext,
            { correlationId },
          )
        : await runtimeServices.clinicBookingRequestsService.updateBookingRequest(
            requestId,
            parseJsonBody(request.body),
            authContext,
            { correlationId },
          );
      return jsonResponse(
        200,
        {
          stage: "5P",
          source: "postgres",
          item: result.bookingRequest,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5Q · external intake import contracts. CRM/ad adapters may push
  // sanitized booking requests and availability slots into this backend; the
  // product never calls those external systems from the browser or API runtime.
  if (url.pathname === "/api/v1/integrations/booking-imports/status" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.externalIntakeImportService.getImportStatus(
        authContext,
        normalizeExternalIntakeStatusParams(url.searchParams),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5T",
          source: "postgres",
          item: result.status,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/integrations/booking-imports" && (method === "GET" || method === "POST")) {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = method === "GET"
        ? await runtimeServices.externalIntakeImportService.listImportBatches(
            authContext,
            normalizeExternalIntakeImportParams(url.searchParams),
            { correlationId },
          )
        : await runtimeServices.externalIntakeImportService.importExternalIntake(
            parseJsonBody(request.body),
            authContext,
            { correlationId },
          );
      return jsonResponse(
        method === "POST" ? 201 : 200,
        method === "POST"
          ? {
              stage: "5Q",
              source: "postgres",
              item: result.batch,
              auth: {
                userId: authContext.userId,
                roles: authContext.roles,
                allClinics: result.scope.allClinics,
              },
              generatedAt: now(),
              correlationId,
            }
          : {
              stage: "5Q",
              source: "postgres",
              items: result.batches.items,
              count: result.batches.count,
              limit: result.batches.limit,
              offset: result.batches.offset,
              filters: result.batches.filters,
              auth: {
                userId: authContext.userId,
                roles: authContext.roles,
                allClinics: result.scope.allClinics,
              },
              generatedAt: now(),
              correlationId,
            },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5R · clinic available slots. Operators read the local PostgreSQL
  // cache populated by Stage 5Q imports; no CRM/scheduling runtime is called.
  if (url.pathname === "/api/v1/clinic/available-slots" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicAvailableSlotsService.listAvailableSlots(
        authContext,
        normalizeClinicAvailableSlotParams(url.searchParams),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5R",
          source: "postgres",
          items: result.slots.items,
          count: result.slots.count,
          limit: result.slots.limit,
          offset: result.slots.offset,
          filters: result.slots.filters,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 4G · self-hosted visit workspace read endpoints.
  const patientVisitsMatch = url.pathname.match(
    /^\/api\/v1\/patients\/([^/]+)\/visits$/,
  );
  if (patientVisitsMatch && method === "GET") {
    try {
      const safePatientId = assertUuid(decodeURIComponent(patientVisitsMatch[1]));
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = visitReadScope(authContext);
      const items = await runtimeServices.visitWorkspaceRepository.listVisitsByPatient({
        patientId: safePatientId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(runtimeServices.auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "visit.list",
        entityType: "visit",
        entityId: safePatientId,
        correlationId,
        metadata: { patientId: safePatientId, count: items.length, allClinics: scope.allClinics },
      });
      return jsonResponse(
        200,
        {
          stage: "4G",
          source: "postgres",
          patientId: safePatientId,
          items,
          count: items.length,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitDetailMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)$/);
  if (visitDetailMatch && method === "GET") {
    try {
      const safeVisitId = assertUuid(decodeURIComponent(visitDetailMatch[1]), "visitId");
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = visitReadScope(authContext);
      const item = await runtimeServices.visitWorkspaceRepository.getVisit({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!item) {
        return errorResponse({
          status: 404,
          code: "visit_not_found",
          message: "Visit was not found in the allowed clinic scope.",
          correlationId,
          config,
          requestOrigin,
        });
      }
      await recordAuditBestEffort(runtimeServices.auditRepository, {
        clinicId: item.clinic.id || null,
        actorUserId: authContext.userId,
        action: "visit.read",
        entityType: "visit",
        entityId: item.id,
        correlationId,
        metadata: { allClinics: scope.allClinics },
      });
      return jsonResponse(
        200,
        {
          stage: "4G",
          source: "postgres",
          item,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionsMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesions$/,
  );
  if (visitLesionsMatch && method === "GET") {
    try {
      const safeVisitId = assertUuid(decodeURIComponent(visitLesionsMatch[1]), "visitId");
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = visitReadScope(authContext);
      const items = await runtimeServices.visitWorkspaceRepository.listVisitLesions({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(runtimeServices.auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "visit.lesions",
        entityType: "lesion",
        entityId: safeVisitId,
        correlationId,
        metadata: { visitId: safeVisitId, count: items.length, allClinics: scope.allClinics },
      });
      return jsonResponse(
        200,
        {
          stage: "4G",
          source: "postgres",
          visitId: safeVisitId,
          items,
          count: items.length,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitAssetsMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/assets$/,
  );
  if (visitAssetsMatch && method === "GET") {
    try {
      const safeVisitId = assertUuid(decodeURIComponent(visitAssetsMatch[1]), "visitId");
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = visitReadScope(authContext);
      const items = await runtimeServices.visitWorkspaceRepository.listVisitAssets({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(runtimeServices.auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "visit.assets",
        entityType: "clinical_asset",
        entityId: safeVisitId,
        correlationId,
        metadata: { visitId: safeVisitId, count: items.length, allClinics: scope.allClinics },
      });
      return jsonResponse(
        200,
        {
          stage: "4G",
          source: "postgres",
          visitId: safeVisitId,
          items,
          count: items.length,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 4I · self-hosted clinical asset write/download-url endpoints.
  if (visitAssetsMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.assetWriteService.createVisitAsset(
        decodeURIComponent(visitAssetsMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "4I",
          source: "postgres",
          item: result.asset,
          upload: {
            mode: "metadata_registered",
            objectStorage: "backend-owned",
          },
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const assetDownloadUrlMatch = url.pathname.match(
    /^\/api\/v1\/assets\/([^/]+)\/download-url$/,
  );
  if (assetDownloadUrlMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.assetWriteService.getAssetDownloadUrl(
        decodeURIComponent(assetDownloadUrlMatch[1]),
        authContext,
        {
          correlationId,
          expiresIn: normalizeDownloadUrlParams(url.searchParams),
        },
      );
      return jsonResponse(
        200,
        {
          stage: "4I",
          source: "postgres",
          item: result.download,
          asset: result.asset,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const assetDownloadMatch = url.pathname.match(
    /^\/api\/v1\/assets\/([^/]+)\/download$/,
  );
  if (assetDownloadMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.assetWriteService.downloadAsset(
        decodeURIComponent(assetDownloadMatch[1]),
        authContext,
        { correlationId },
      );
      return binaryResponse(
        200,
        {
          body: result.object.bytes,
          contentType: result.object.contentType,
          fileName: safeContentDispositionFileName(result.asset),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 4H · self-hosted visit workspace write endpoints.
  if (visitDetailMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.visitWorkspaceWriteService.updateVisit(
        decodeURIComponent(visitDetailMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4H",
          source: "postgres",
          item: result.visit,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (visitLesionsMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.visitWorkspaceWriteService.createLesion(
        decodeURIComponent(visitLesionsMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "4H",
          source: "postgres",
          item: result.lesion,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const lesionMatch = url.pathname.match(/^\/api\/v1\/lesions\/([^/]+)$/);
  if (lesionMatch && (method === "PATCH" || method === "DELETE")) {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const lesionId = decodeURIComponent(lesionMatch[1]);
      const result = method === "PATCH"
        ? await runtimeServices.visitWorkspaceWriteService.updateLesion(
            lesionId,
            parseJsonBody(request.body),
            authContext,
            { correlationId },
          )
        : await runtimeServices.visitWorkspaceWriteService.archiveLesion(
            lesionId,
            authContext,
            { correlationId },
          );
      return jsonResponse(
        200,
        {
          stage: "4H",
          source: "postgres",
          archived: method === "DELETE",
          item: result.lesion,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5H · production clinical workspace assessment/conclusion/report contracts.
  const visitAssessmentMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)\/assessment$/);
  if (visitAssessmentMatch && (method === "GET" || method === "PATCH")) {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitAssessmentMatch[1]);
      const result = method === "GET"
        ? await runtimeServices.clinicalWorkspaceService.getAssessment(
            visitIdFromPath,
            authContext,
            { correlationId },
          )
        : await runtimeServices.clinicalWorkspaceService.updateAssessment(
            visitIdFromPath,
            parseJsonBody(request.body),
            authContext,
            { correlationId },
          );
      return jsonResponse(
        method === "GET" ? 200 : 200,
        {
          stage: "5H",
          source: "postgres",
          item: result.assessment,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitConclusionMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)\/conclusion$/);
  if (visitConclusionMatch && (method === "GET" || method === "PATCH")) {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitConclusionMatch[1]);
      const result = method === "GET"
        ? await runtimeServices.clinicalWorkspaceService.getConclusion(
            visitIdFromPath,
            authContext,
            { correlationId },
          )
        : await runtimeServices.clinicalWorkspaceService.updateConclusion(
            visitIdFromPath,
            parseJsonBody(request.body),
            authContext,
            { correlationId },
          );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.conclusion,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitReportMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)\/report$/);
  if (visitReportMatch && (method === "GET" || method === "PATCH")) {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitReportMatch[1]);
      const result = method === "GET"
        ? await runtimeServices.clinicalWorkspaceService.getReport(
            visitIdFromPath,
            authContext,
            { correlationId },
          )
        : await runtimeServices.visitWorkspaceWriteService.updateReport(
            visitIdFromPath,
            parseJsonBody(request.body),
            authContext,
            { correlationId },
          );
      return jsonResponse(
        200,
        {
          stage: method === "GET" ? "5H" : "4H",
          source: "postgres",
          item: result.report,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionComparisonDraftMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesion-comparison-draft$/,
  );
  if (visitLesionComparisonDraftMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitLesionComparisonDraftMatch[1]);
      const result = await runtimeServices.clinicalWorkspaceService.saveLesionComparisonDraft(
        visitIdFromPath,
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.draft,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionComparisonViewerQaReviewQueueMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesion-comparison-viewer-qa\/review-queue$/,
  );
  if (visitLesionComparisonViewerQaReviewQueueMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitLesionComparisonViewerQaReviewQueueMatch[1]);
      const result = await runtimeServices.clinicalWorkspaceService.getVisitLesionComparisonViewerQaReviewQueue(
        visitIdFromPath,
        url.searchParams,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.queue,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLongitudinalDatasetValidationMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/longitudinal-dataset-validation$/,
  );
  if (visitLongitudinalDatasetValidationMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalWorkspaceService.getVisitLongitudinalDatasetValidation(
        decodeURIComponent(visitLongitudinalDatasetValidationMatch[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.validation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionComparisonViewerQaReviewMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesion-comparison-viewer-qa\/review$/,
  );
  if (visitLesionComparisonViewerQaReviewMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitLesionComparisonViewerQaReviewMatch[1]);
      const result = await runtimeServices.clinicalWorkspaceService.reviewLesionComparisonViewerQa(
        visitIdFromPath,
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.qa,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionComparisonViewerQaReviewerWorkflowMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesion-comparison-viewer-qa\/reviewer-workflow$/,
  );
  if (visitLesionComparisonViewerQaReviewerWorkflowMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitLesionComparisonViewerQaReviewerWorkflowMatch[1]);
      const result = await runtimeServices.clinicalWorkspaceService.reviewLesionComparisonViewerQaReviewerWorkflow(
        visitIdFromPath,
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.qa,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionComparisonMeasurementPolicyMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesion-comparison-viewer-qa\/measurement-policy$/,
  );
  if (visitLesionComparisonMeasurementPolicyMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitLesionComparisonMeasurementPolicyMatch[1]);
      const result = await runtimeServices.clinicalWorkspaceService.reviewLesionComparisonMeasurementPolicy(
        visitIdFromPath,
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.qa,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitLesionComparisonViewerQaMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/lesion-comparison-viewer-qa$/,
  );
  if (visitLesionComparisonViewerQaMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitLesionComparisonViewerQaMatch[1]);
      const result = await runtimeServices.clinicalWorkspaceService.saveLesionComparisonViewerQa(
        visitIdFromPath,
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.qa,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const visitAssetCaptureMetadataMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/assets\/([^/]+)\/capture-metadata$/,
  );
  if (visitAssetCaptureMetadataMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalWorkspaceService.saveAssetCaptureMetadata(
        decodeURIComponent(visitAssetCaptureMetadataMatch[1]),
        decodeURIComponent(visitAssetCaptureMetadataMatch[2]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.metadata,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const lesionLongitudinalQaMatch = url.pathname.match(
    /^\/api\/v1\/patients\/([^/]+)\/lesions\/([^/]+)\/longitudinal-qa$/,
  );
  if (lesionLongitudinalQaMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalWorkspaceService.getLesionLongitudinalQa(
        decodeURIComponent(lesionLongitudinalQaMatch[1]),
        decodeURIComponent(lesionLongitudinalQaMatch[2]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.qa,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const lesionLongitudinalHistoryMatch = url.pathname.match(
    /^\/api\/v1\/patients\/([^/]+)\/lesions\/([^/]+)\/longitudinal-history$/,
  );
  if (lesionLongitudinalHistoryMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const patientIdFromPath = decodeURIComponent(lesionLongitudinalHistoryMatch[1]);
      const lesionIdFromPath = decodeURIComponent(lesionLongitudinalHistoryMatch[2]);
      const result = await runtimeServices.clinicalWorkspaceService.getLesionLongitudinalHistory(
        patientIdFromPath,
        lesionIdFromPath,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.history,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const lesionCaptureMetadataMatch = url.pathname.match(
    /^\/api\/v1\/patients\/([^/]+)\/lesions\/([^/]+)\/capture-metadata$/,
  );
  if (lesionCaptureMetadataMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalWorkspaceService.getLesionCaptureMetadata(
        decodeURIComponent(lesionCaptureMetadataMatch[1]),
        decodeURIComponent(lesionCaptureMetadataMatch[2]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5H",
          source: "postgres",
          item: result.metadata,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const protectedLesionImageRenderMatch = url.pathname.match(
    /^\/api\/v1\/patients\/([^/]+)\/lesions\/([^/]+)\/images\/([^/]+)\/render$/,
  );
  if (protectedLesionImageRenderMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalWorkspaceService.downloadProtectedLesionImage(
        {
          patientId: decodeURIComponent(protectedLesionImageRenderMatch[1]),
          lesionId: decodeURIComponent(protectedLesionImageRenderMatch[2]),
          assetId: decodeURIComponent(protectedLesionImageRenderMatch[3]),
        },
        authContext,
        { correlationId },
      );
      return binaryResponse(
        200,
        {
          body: result.object.bytes,
          contentType: result.object.contentType,
          fileName: result.download.fileName,
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 8G-8I · clinical reporting completion package.
  const visitReportPackageMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)\/report-package$/);
  if (visitReportPackageMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(visitReportPackageMatch[1]);
      const result = await runtimeServices.clinicalReportPackageService.getReportPackage(
        visitIdFromPath,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.reportPackage,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch R · patient photo/protocol release ledger. Metadata only; no file delivery.
  const patientPhotoProtocolReleaseMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/patient-photo-protocol-release(?:\/(revoke))?$/,
  );
  if (patientPhotoProtocolReleaseMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(patientPhotoProtocolReleaseMatch[1]);
      const body = parseJsonBody(request.body);
      const result = patientPhotoProtocolReleaseMatch[2] === "revoke"
        ? await runtimeServices.patientPhotoProtocolReleaseService.revokeRelease(
            visitIdFromPath,
            body,
            authContext,
            { correlationId },
          )
        : await runtimeServices.patientPhotoProtocolReleaseService.prepareRelease(
            visitIdFromPath,
            body,
            authContext,
            { correlationId },
          );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.release,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch Y · doctor policy-governance review for patient photo/protocol release.
  // Marker: patient-photo-protocol-release/policy
  const patientPhotoProtocolReleasePolicyMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/patient-photo-protocol-release\/policy$/,
  );
  if (patientPhotoProtocolReleasePolicyMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(patientPhotoProtocolReleasePolicyMatch[1]);
      const body = parseJsonBody(request.body);
      const result = await runtimeServices.patientPhotoProtocolReleaseService.reviewPolicy(
        visitIdFromPath,
        body,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.release,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch W · staff/admin immutable audit review for patient photo/protocol release.
  const patientPhotoProtocolReleaseAuditMatch = url.pathname.match(
    /^\/api\/v1\/visits\/([^/]+)\/patient-photo-protocol-release\/audit$/,
  );
  if (patientPhotoProtocolReleaseAuditMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const visitIdFromPath = decodeURIComponent(patientPhotoProtocolReleaseAuditMatch[1]);
      const result = await runtimeServices.patientPhotoProtocolReleaseService.getReleaseAudit(
        visitIdFromPath,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.audit,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AB · aggregate admin governance for patient photo/protocol release.
  const patientPhotoProtocolReleaseGovernanceMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance";
  if (patientPhotoProtocolReleaseGovernanceMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPhotoProtocolReleaseService.getGovernance(
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.governance,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AD · production-safe aggregate revoke execution for expired access windows.
  const patientPhotoProtocolReleaseGovernanceRevokeExpiredMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance/revoke-expired";
  if (patientPhotoProtocolReleaseGovernanceRevokeExpiredMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const body = parseJsonBody(request.body);
      const result = await runtimeServices.patientPhotoProtocolReleaseService.executeGovernanceRevokeExpired(
        body,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.operation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AE · production-safe aggregate block execution for missing-expiry access windows.
  const patientPhotoProtocolReleaseGovernanceBlockMissingExpiryMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance/block-missing-expiry";
  if (patientPhotoProtocolReleaseGovernanceBlockMissingExpiryMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const body = parseJsonBody(request.body);
      const result = await runtimeServices.patientPhotoProtocolReleaseService.executeGovernanceBlockMissingExpiry(
        body,
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.operation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AF · production-safe aggregate block execution for unapproved-retention access windows.
  const patientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance/block-unapproved-retention";
  if (patientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const body = parseJsonBody(request.body);
      const result =
        await runtimeServices.patientPhotoProtocolReleaseService.executeGovernanceBlockUnapprovedRetention(
          body,
          authContext,
          { correlationId },
        );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.operation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AH · production-safe aggregate block execution for unsafe session artifacts.
  const patientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance/block-unsafe-session-artifacts";
  if (patientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const body = parseJsonBody(request.body);
      const result =
        await runtimeServices.patientPhotoProtocolReleaseService.executeGovernanceBlockUnsafeSessionArtifacts(
          body,
          authContext,
          { correlationId },
        );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.operation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AI · production-safe aggregate preparation for access-artifact rotation.
  const patientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance/prepare-access-artifact-rotation";
  if (patientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const body = parseJsonBody(request.body);
      const result =
        await runtimeServices.patientPhotoProtocolReleaseService.executeGovernancePrepareAccessArtifactRotation(
          body,
          authContext,
          { correlationId },
        );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.operation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Batch AJ · production-safe credential hash store issuance.
  const patientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashMatch =
    url.pathname === "/api/v1/patient-photo-protocol-release/governance/issue-access-credential-hash";
  if (patientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const body = parseJsonBody(request.body);
      const result =
        await runtimeServices.patientPhotoProtocolReleaseService.executeGovernanceIssueAccessCredentialHash(
          body,
          authContext,
          { correlationId },
        );
      return jsonResponse(
        200,
        {
          stage: "8G-8I",
          source: "postgres",
          item: result.operation,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 4R · self-hosted Device Bridge command queue endpoints.
  const bridgeCommandMatch = url.pathname.match(/^\/api\/v1\/device-bridges\/([^/]+)\/commands$/);
  if (bridgeCommandMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeCommandService.requestBridgeCommand(
        decodeURIComponent(bridgeCommandMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        202,
        {
          stage: "4R",
          source: "postgres",
          command: result.command,
          bridge: result.bridge,
          mode: result.mode,
          execution: {
            status: "queued",
            worker: "local_device_bridge",
            browserHardwareAccess: false,
          },
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const deviceCommandMatch = url.pathname.match(/^\/api\/v1\/devices\/([^/]+)\/commands$/);
  if (deviceCommandMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeCommandService.requestDeviceCommand(
        decodeURIComponent(deviceCommandMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        202,
        {
          stage: "4R",
          source: "postgres",
          command: result.command,
          device: result.device,
          mode: result.mode,
          execution: {
            status: "queued",
            worker: "local_device_bridge",
            browserHardwareAccess: false,
          },
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 4S · local Device Bridge worker contract endpoints.
  if (url.pathname === "/api/v1/device-bridge-worker/heartbeat" && method === "POST") {
    try {
      const result = await runtimeServices.deviceBridgeWorkerService.recordHeartbeat(
        request.headers,
        parseJsonBody(request.body),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4S",
          source: "postgres",
          bridge: result.bridge,
          worker: {
            authenticated: true,
            id: result.worker.workerId,
            authType: result.worker.authType,
          },
          heartbeat: {
            bridgeCode: result.heartbeat.bridgeCode,
            lanStatus: result.heartbeat.lanStatus,
            workerStatus: result.heartbeat.workerStatus,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/device-bridge-worker/commands" && method === "GET") {
    try {
      const result = await runtimeServices.deviceBridgeWorkerService.listCommands(
        request.headers,
        url.searchParams,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4S",
          source: "postgres",
          items: result.commands,
          count: result.commands.length,
          bridgeCode: result.query.bridgeCode,
          worker: {
            authenticated: true,
            id: result.worker.workerId,
            authType: result.worker.authType,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const workerCommandMatch = url.pathname.match(
    /^\/api\/v1\/device-bridge-worker\/commands\/([^/]+)$/,
  );
  if (workerCommandMatch && method === "PATCH") {
    try {
      const result = await runtimeServices.deviceBridgeWorkerService.updateCommandStatus(
        decodeURIComponent(workerCommandMatch[1]),
        request.headers,
        parseJsonBody(request.body),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4S",
          source: "postgres",
          command: result.command,
          lifecycle: {
            status: result.status,
            persisted: true,
          },
          worker: {
            authenticated: true,
            id: result.worker.workerId,
            authType: result.worker.authType,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/device-bridge-worker/status" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.listWorkerTelemetry(
        authContext,
        url.searchParams,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4U",
          source: result.source,
          summary: result.summary,
          items: result.bridges,
          commands: result.commands,
          count: result.bridges.length,
          commandCount: result.commands.length,
          filters: result.filters,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/device-bridge-worker/hardening" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.listWorkerHardening(
        authContext,
        url.searchParams,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4V",
          source: result.source,
          summary: result.summary,
          policy: result.policy,
          items: result.bridges,
          count: result.bridges.length,
          filters: result.filters,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/device-bridge-worker/recovery" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.listWorkerRecovery(
        authContext,
        url.searchParams,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4W",
          source: result.source,
          summary: result.summary,
          policy: result.policy,
          items: result.commands,
          count: result.commands.length,
          filters: result.filters,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const workerCommandRecoveryMatch = url.pathname.match(
    /^\/api\/v1\/device-bridge-worker\/commands\/([^/]+)\/recovery$/,
  );
  if (workerCommandRecoveryMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.recoverCommand(
        decodeURIComponent(workerCommandRecoveryMatch[1]),
        authContext,
        parseJsonBody(request.body),
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4W",
          source: "postgres",
          command: result.command,
          recovery: {
            action: result.action,
            persisted: true,
          },
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/device-bridge-worker/audit" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.listWorkerCommandAudit(
        authContext,
        url.searchParams,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4X",
          source: result.source,
          summary: result.summary,
          policy: result.policy,
          items: result.events,
          count: result.events.length,
          filters: result.filters,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/device-bridge-worker/audit/export" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.exportWorkerCommandAudit(
        authContext,
        url.searchParams,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4Y",
          source: result.source,
          export: result.export,
          policy: result.policy,
          filters: result.filters,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 8J-8L · Device Bridge production readiness.
  if (url.pathname === "/api/v1/device-bridge-worker/production-readiness" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeProductionReadinessService.getProductionReadiness(
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "8J-8L",
          source: "postgres",
          readiness: result.readiness,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 8P-9A · Device Bridge operations continuity.
  if (url.pathname === "/api/v1/device-bridge-worker/operations-continuity" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeOperationsContinuityService.getOperationsContinuity(
        authContext,
        { correlationId, generatedAt: now() },
      );
      return jsonResponse(
        200,
        {
          stage: "8P-9A",
          source: "postgres",
          continuity: result.continuity,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 9B-9M · Device Bridge fleet reliability.
  if (url.pathname === "/api/v1/device-bridge-worker/fleet-reliability" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeFleetReliabilityService.getFleetReliability(
        authContext,
        { correlationId, generatedAt: now() },
      );
      return jsonResponse(
        200,
        {
          stage: "9B-9M",
          source: "postgres",
          reliability: result.reliability,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 9N-9Z · Device Bridge lifecycle assurance.
  if (url.pathname === "/api/v1/device-bridge-worker/lifecycle-assurance" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeLifecycleAssuranceService.getLifecycleAssurance(
        authContext,
        { correlationId, generatedAt: now() },
      );
      return jsonResponse(
        200,
        {
          stage: "9N-9Z",
          source: "postgres",
          assurance: result.assurance,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const workerCommandReplayMatch = url.pathname.match(
    /^\/api\/v1\/device-bridge-worker\/commands\/([^/]+)\/replay$/,
  );
  if (workerCommandReplayMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.deviceBridgeWorkerService.replayCommand(
        decodeURIComponent(workerCommandReplayMatch[1]),
        authContext,
        parseJsonBody(request.body),
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "4X",
          source: "postgres",
          command: result.command,
          replay: {
            persisted: true,
            policy: result.command.replayPolicy || "manual_system_admin",
            sourceCommandId: result.command.replayOfCommandId,
          },
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/doctor/dashboard" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.doctorDashboardService.getDashboard(authContext, {
        correlationId,
      });
      return jsonResponse(
        200,
        {
          stage: "5I",
          source: "postgres",
          dashboard: result.dashboard,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 5N · production patient portal read contracts.
  if (url.pathname === "/api/v1/me/portal" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.getOverview(authContext, {
        correlationId,
      });
      return jsonResponse(
        200,
        {
          stage: "5N",
          source: "postgres",
          portal: result.overview,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/me/history" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.getHistory(authContext, {
        correlationId,
      });
      return jsonResponse(
        200,
        {
          stage: "5N",
          source: "postgres",
          history: result.history,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const patientPortalReportMatch = url.pathname.match(/^\/api\/v1\/me\/reports\/([^/]+)$/);
  if (patientPortalReportMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.getReport(
        decodeURIComponent(patientPortalReportMatch[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5N",
          source: "postgres",
          item: result.report,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const patientPortalPhotoProxyMatch = url.pathname.match(
    /^\/api\/v1\/me\/photo-protocols\/([^/]+)\/photos\/([^/]+)\/download$/,
  );
  if (patientPortalPhotoProxyMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPhotoProtocolDeliveryService.downloadPhoto(
        {
          visitId: decodeURIComponent(patientPortalPhotoProxyMatch[1]),
          sequence: decodeURIComponent(patientPortalPhotoProxyMatch[2]),
        },
        authContext,
        {
          correlationId,
          sessionCookieValue: readCookieValue(request.headers, "sd_photo_protocol_session"),
        },
      );
      return binaryResponse(
        200,
        {
          body: result.object.bytes,
          contentType: result.object.contentType,
          fileName: result.download.fileName,
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const patientPortalPhotoProtocolAccessExchangeMatch = url.pathname.match(
    /^\/api\/v1\/me\/photo-protocols\/([^/]+)\/access\/exchange$/,
  );
  if (patientPortalPhotoProtocolAccessExchangeMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.exchangePhotoProtocolAccess(
        decodeURIComponent(patientPortalPhotoProtocolAccessExchangeMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      const response = jsonResponse(
        200,
        {
          stage: "5N",
          source: "postgres",
          item: result.exchange,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
      const setCookie = serializeHttpOnlyCookie(result.sessionCookie);
      if (setCookie) response.headers["set-cookie"] = setCookie;
      return response;
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const patientPortalPhotoProtocolAccessSessionEndMatch = url.pathname.match(
    /^\/api\/v1\/me\/photo-protocols\/([^/]+)\/access\/session\/end$/,
  );
  if (patientPortalPhotoProtocolAccessSessionEndMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.endPhotoProtocolAccessSession(
        decodeURIComponent(patientPortalPhotoProtocolAccessSessionEndMatch[1]),
        authContext,
        {
          correlationId,
          sessionCookieValue: readCookieValue(request.headers, "sd_photo_protocol_session"),
        },
      );
      const response = jsonResponse(
        200,
        {
          stage: "5N",
          source: "postgres",
          item: result.sessionEnd,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
      const setCookie = serializeHttpOnlyCookie(result.sessionCookie);
      if (setCookie) response.headers["set-cookie"] = setCookie;
      return response;
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Patient photo protocol routes live under /api/v1/me/photo-protocols.
  const patientPortalPhotoProtocolMatch = url.pathname.match(/^\/api\/v1\/me\/photo-protocols\/([^/]+)$/);
  if (patientPortalPhotoProtocolMatch && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.getPhotoProtocol(
        decodeURIComponent(patientPortalPhotoProtocolMatch[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5N",
          source: "postgres",
          item: result.photoProtocol,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/me/booking-requests" && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.createBookingRequest(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "5O",
          source: "postgres",
          item: result.bookingRequest,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/me/reminder-preferences" && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.patientPortalService.updateReminderPreferences(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "5O",
          source: "postgres",
          item: result.reminderPreferences,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  // Stage 17A-17Z · clinical follow-up and patient communication loop.
  if (url.pathname === "/api/v1/clinical/follow-ups" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.listClinicalFollowUps(
        normalizeClinicalFollowUpParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "17A-17Z",
          source: "postgres",
          items: result.result.items,
          limit: result.result.limit,
          offset: result.result.offset,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/operations/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpOperationsSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "18A-18Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/outcomes/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpOutcomeQualitySummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "19A-19Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/clinic-review/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpClinicReviewSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "20A-20Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-validation/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopValidationSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "21A-21Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-templates/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyTemplateSummary(
        normalizeClinicalFollowUpSopPolicyTemplateParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "22A-22Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-templates" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.listClinicalFollowUpSopPolicyTemplates(
        normalizeClinicalFollowUpSopPolicyTemplateParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "22A-22Z",
          source: "postgres",
          items: result.result.items,
          limit: result.result.limit,
          offset: result.result.offset,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-templates" && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.createClinicalFollowUpSopPolicyTemplate(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "22A-22Z",
          source: "postgres",
          item: result.template,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-application/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyApplicationSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "23A-23Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyExceptionClosureSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "24A-24Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-audit/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyAuditRollupSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "25A-25Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceReadinessSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "26A-26Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceClosureSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "27A-27Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "28A-28Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "29A-29Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "30A-30Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "31A-31Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "32A-32Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "33A-33Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "34A-34Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "35A-35Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "36A-36Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "37A-37Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "41A-41Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "42A-42Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "43A-43Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "44A-44Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "45A-45Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }


  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "40A-40Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "39A-39Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "38A-38Z",
          source: "postgres",
          item: result.summary,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/operations" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.listClinicalFollowUpOperations(
        normalizeClinicalFollowUpOperationsParams(url.searchParams),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "18A-18Z",
          source: "postgres",
          items: result.result.items,
          limit: result.result.limit,
          offset: result.result.offset,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const createVisitFollowUpMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)\/follow-ups$/);
  if (createVisitFollowUpMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.createClinicalFollowUp(
        decodeURIComponent(createVisitFollowUpMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "17A-17Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpOperationsMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/operations$/);
  if (clinicalFollowUpOperationsMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpOperations(
        decodeURIComponent(clinicalFollowUpOperationsMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "18A-18Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpQualityMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/quality$/);
  if (clinicalFollowUpQualityMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpQuality(
        decodeURIComponent(clinicalFollowUpQualityMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "19A-19Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpClinicReviewMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/clinic-review$/);
  if (clinicalFollowUpClinicReviewMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpClinicReview(
        decodeURIComponent(clinicalFollowUpClinicReviewMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "20A-20Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopValidationMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-validation$/);
  if (clinicalFollowUpSopValidationMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopValidation(
        decodeURIComponent(clinicalFollowUpSopValidationMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "21A-21Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyApplicationMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-application$/);
  if (clinicalFollowUpSopPolicyApplicationMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyApplication(
        decodeURIComponent(clinicalFollowUpSopPolicyApplicationMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "23A-23Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyExceptionClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-exception$/);
  if (clinicalFollowUpSopPolicyExceptionClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyExceptionClosure(
        decodeURIComponent(clinicalFollowUpSopPolicyExceptionClosureMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "24A-24Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyAuditRollupMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-audit$/);
  if (clinicalFollowUpSopPolicyAuditRollupMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyAuditRollup(
        decodeURIComponent(clinicalFollowUpSopPolicyAuditRollupMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "25A-25Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceReadinessMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance$/);
  if (clinicalFollowUpSopPolicyGovernanceReadinessMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceReadiness(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceReadinessMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "26A-26Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-closure$/);
  if (clinicalFollowUpSopPolicyGovernanceClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceClosure(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceClosureMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "27A-27Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidence(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "28A-28Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "29A-29Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "30A-30Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "31A-31Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "32A-32Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "33A-33Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "34A-34Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "35A-35Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "36A-36Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "37A-37Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary(normalizeClinicalFollowUpOperationsParams(url.searchParams), authContext, { correlationId });
      return jsonResponse(200, { stage: "46A-46Z", source: "postgres", item: result.summary, auth: { userId: authContext.userId, scope: result.scope }, correlationId }, config, requestOrigin);
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(normalizeClinicalFollowUpOperationsParams(url.searchParams), authContext, { correlationId });
      return jsonResponse(200, { stage: "47A-47Z", source: "postgres", item: result.summary, auth: { userId: authContext.userId, scope: result.scope }, correlationId }, config, requestOrigin);
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure$/);
  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "42A-42Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "43A-43Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "44A-44Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "45A-45Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure(decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureMatch[1]), parseJsonBody(request.body), authContext, { correlationId });
      return jsonResponse(200, { stage: "46A-46Z", source: "postgres", item: result.followUp, auth: { userId: authContext.userId, scope: result.scope }, correlationId }, config, requestOrigin);
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt(decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptMatch[1]), parseJsonBody(request.body), authContext, { correlationId });
      return jsonResponse(200, { stage: "47A-47Z", source: "postgres", item: result.followUp, auth: { userId: authContext.userId, scope: result.scope }, correlationId }, config, requestOrigin);
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }


  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "41A-41Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "40A-40Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "39A-39Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure$/);
  if (clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure(
        decodeURIComponent(clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "38A-38Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            scope: result.scope,
          },
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpSopPolicyTemplateMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/sop-policy-templates\/([^/]+)$/);
  if (clinicalFollowUpSopPolicyTemplateMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUpSopPolicyTemplate(
        decodeURIComponent(clinicalFollowUpSopPolicyTemplateMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "22A-22Z",
          source: "postgres",
          item: result.template,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)$/);
  if (clinicalFollowUpMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.updateClinicalFollowUp(
        decodeURIComponent(clinicalFollowUpMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "17A-17Z",
          source: "postgres",
          item: result.followUp,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const clinicalFollowUpMessageMatch = url.pathname.match(/^\/api\/v1\/clinical\/follow-ups\/([^/]+)\/messages$/);
  if (clinicalFollowUpMessageMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.createClinicalFollowUpMessage(
        decodeURIComponent(clinicalFollowUpMessageMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "17A-17Z",
          source: "postgres",
          item: result.message,
          auth: {
            userId: authContext.userId,
            roles: result.scope.roles,
            allClinics: result.scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (url.pathname === "/api/v1/me/follow-ups" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.listPatientFollowUps(
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "17A-17Z",
          source: "postgres",
          items: result.result.items,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  const patientFollowUpMessageMatch = url.pathname.match(/^\/api\/v1\/me\/follow-ups\/([^/]+)\/messages$/);
  if (patientFollowUpMessageMatch && method === "POST") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.clinicalFollowUpService.createPatientFollowUpMessage(
        decodeURIComponent(patientFollowUpMessageMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "17A-17Z",
          source: "postgres",
          item: result.message,
          auth: {
            userId: result.scope.userId,
            roles: result.scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({ ...publicError, correlationId, config, requestOrigin });
    }
  }

  if (method !== "GET") {
    return errorResponse({
      status: 405,
      code: "method_not_allowed",
      message: "This self-hosted backend route does not allow the requested method in Stage 5O.",
      correlationId,
      config,
      requestOrigin,
    });
  }

  if (url.pathname === "/api/v1/patients") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = patientReadScope(authContext);
      const result = await runtimeServices.patientRepository.listPatients(
        {
          ...parsePatientListParams(url.searchParams),
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        },
      );
      await recordAuditBestEffort(
        runtimeServices.auditRepository,
        {
          clinicId: scope.allClinics ? null : scope.clinicIds[0],
          actorUserId: authContext.userId,
          action: "patient.list",
          entityType: "patient",
          correlationId,
          metadata: {
            count: result.count,
            allClinics: scope.allClinics,
          },
        },
      );
      return jsonResponse(
        200,
        {
          stage: "4D",
          ...result,
          auth: {
            userId: authContext.userId,
            roles: authContext.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/auth/me") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      if (!authContext?.userId) {
        return errorResponse({
          status: 401,
          code: "auth_required",
          message: "Authentication is required.",
          correlationId,
          config,
          requestOrigin,
        });
      }
      return jsonResponse(
        200,
        {
          stage: "4D",
          user: {
            id: authContext.userId,
            displayName: authContext.displayName,
            roles: authContext.roleBindings,
          },
          token: authContext.token,
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/ops/status") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = opsStatusScope(authContext);
      const readiness = await runtimeReadiness(config, runtimeServices.dbClient);
      await recordAuditBestEffort(
        runtimeServices.auditRepository,
        {
          clinicId: null,
          actorUserId: authContext.userId,
          action: "ops.status.read",
          entityType: "ops_status",
          correlationId,
          metadata: {
            status: readiness.status,
            dependencyCount: readiness.dependencies.length,
          },
        },
      );
      return jsonResponse(
        200,
        {
          stage: "4N",
          source: "self-hosted",
          ready: readiness.ready,
          status: readiness.status,
          dependencies: readiness.dependencies.map((dependency) => ({
            name: dependency.name,
            configured: Boolean(dependency.configured),
            connected: Boolean(dependency.connected),
            status: dependency.status,
          })),
          observability: {
            structuredJsonLogs: true,
            correlationHeader: "x-correlation-id",
            redaction: "enabled",
            requestPathLogging: "path-only",
          },
          audit: {
            mode: "append-only",
            safeExport: "scripts/stage4n-audit-export.mjs --dry-run",
            exportedFields: [
              "created_at",
              "action",
              "entity_type",
              "entity_id",
              "correlation_id",
            ],
          },
          auth: {
            userId: authContext.userId,
            roles: scope.roles,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/ops/runtime-checks") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = opsStatusScope(authContext);
      const runtimeChecks = await collectSelfHostedOpsRuntimeChecks({
        config,
        dbClient: runtimeServices.dbClient,
        now,
        correlationId,
      });
      await recordAuditBestEffort(
        runtimeServices.auditRepository,
        {
          clinicId: null,
          actorUserId: authContext.userId,
          action: "ops.runtime_checks.read",
          entityType: "ops_runtime_checks",
          correlationId,
          metadata: {
            status: runtimeChecks.status,
            checkCount: runtimeChecks.checks.length,
            commandCount: runtimeChecks.commands.length,
          },
        },
      );
      return jsonResponse(
        200,
        {
          ...runtimeChecks,
          auth: {
            userId: authContext.userId,
            roles: scope.roles,
          },
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/product/readiness") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = opsStatusScope(authContext);
      const readiness = buildSelfHostedProductReadiness({
        config,
        generatedAt: now(),
        correlationId,
      });
      await recordAuditBestEffort(
        runtimeServices.auditRepository,
        {
          clinicId: null,
          actorUserId: authContext.userId,
          action: "product.readiness.read",
          entityType: "self_hosted_product",
          correlationId,
          metadata: {
            status: readiness.status,
            capabilityCount: readiness.capabilities.length,
            gateCount: readiness.gates.length,
          },
        },
      );
      return jsonResponse(
        200,
        {
          ...readiness,
          auth: {
            userId: authContext.userId,
            roles: scope.roles,
          },
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/device-bridges" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = deviceReadScope(authContext);
      const params = parseDeviceRegistryParams(url.searchParams);
      const result = await runtimeServices.deviceRegistryRepository.listDeviceBridges({
        bridgeStatus: params.bridgeStatus,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(runtimeServices.auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "device_bridge.list",
        entityType: "device_bridge",
        correlationId,
        metadata: { count: result.count, allClinics: scope.allClinics },
      });
      return jsonResponse(
        200,
        {
          stage: "4Q",
          source: "postgres",
          items: result.items,
          count: result.count,
          auth: {
            userId: authContext.userId,
            roles: scope.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/api/v1/devices" && method === "GET") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const scope = deviceReadScope(authContext);
      const params = parseDeviceRegistryParams(url.searchParams);
      const result = await runtimeServices.deviceRegistryRepository.listMedicalDevices({
        ...params,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(runtimeServices.auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "device.list",
        entityType: "device",
        correlationId,
        metadata: {
          count: result.count,
          status: result.status,
          needsCalibration: result.needsCalibration,
          allClinics: scope.allClinics,
        },
      });
      return jsonResponse(
        200,
        {
          stage: "4Q",
          source: "postgres",
          items: result.items,
          count: result.count,
          limit: result.limit,
          offset: result.offset,
          search: result.search,
          status: result.status,
          needsCalibration: result.needsCalibration,
          auth: {
            userId: authContext.userId,
            roles: scope.roles,
            allClinics: scope.allClinics,
          },
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    } catch (error) {
      const publicError = publicErrorFor(error);
      return errorResponse({
        ...publicError,
        correlationId,
        config,
        requestOrigin,
      });
    }
  }

  if (url.pathname === "/healthz") {
    return jsonResponse(
      200,
      {
        status: "ok",
        service: config.serviceName,
        deploymentMode: config.deploymentMode,
        generatedAt: now(),
        correlationId,
      },
      config,
      requestOrigin,
    );
  }

  if (url.pathname === "/readyz") {
    const readiness = await runtimeReadiness(config, runtimeServices.dbClient);
    return jsonResponse(
      readiness.ready ? 200 : 503,
      {
        ...readiness,
        service: config.serviceName,
        generatedAt: now(),
        correlationId,
      },
      config,
      requestOrigin,
    );
  }

  if (url.pathname === "/api/v1/meta") {
    return jsonResponse(
      200,
      {
        apiVersion: "v1",
        stage: "5T",
        deploymentMode: config.deploymentMode,
        service: publicConfig(config),
        capabilities: {
          auth: "local-jwt",
          patients: "rbac-read-write-postgres",
          visits: "rbac-read-write-postgres",
          lesions: "rbac-read-write-postgres",
          clinicalWorkspace: "rbac-read-write-postgres",
          doctorDashboard: "rbac-read-postgres",
          visitSchedule: "rbac-read-postgres",
          leadsAppointments: "rbac-read-write-postgres",
          clinicBookingRequests: "rbac-read-write-postgres",
          clinicBookingSlotConfirmation: "rbac-write-postgres-local-slot-cache",
          externalIntakeImports: "rbac-read-write-postgres-inbound-only-idempotent-redacted-status",
          clinicAvailableSlots: "rbac-read-postgres-local-import-cache",
          clinicalReportPackage: "rbac-read-postgres-readiness-package",
          patientPortal: "patient-owned-read-postgres",
          patientPortalWrites: "patient-owned-write-postgres",
          clinicalFollowUps: "rbac-read-write-postgres-patient-portal-local-communication",
          clinicalFollowUpOperations: "rbac-read-write-postgres-sla-triage-escalation-local-evidence",
          clinicalFollowUpOutcomeQuality: "rbac-read-write-postgres-outcome-quality-local-evidence",
          clinicalFollowUpClinicReview: "rbac-read-write-postgres-retention-clinic-review-local-evidence",
          clinicalFollowUpSopValidation: "rbac-read-write-postgres-clinic-specific-sop-validation-local-evidence",
          clinicalFollowUpSopPolicyTemplates: "rbac-read-write-postgres-local-clinic-sop-policy-templates",
          clinicalFollowUpSopPolicyApplication: "rbac-read-write-postgres-local-sop-policy-application-drift-review",
          clinicalFollowUpSopPolicyExceptionClosure: "rbac-read-write-postgres-local-sop-policy-exception-closure",
          clinicalFollowUpSopPolicyAuditRollup: "rbac-read-write-postgres-local-sop-policy-audit-rollup",
          clinicalFollowUpSopPolicyGovernanceReadiness: "rbac-read-write-postgres-local-sop-policy-governance-readiness",
          clinicalFollowUpSopPolicyGovernanceClosure: "rbac-read-write-postgres-local-sop-policy-governance-closure",
          clinicalFollowUpSopPolicyGovernanceEvidence: "rbac-read-write-postgres-local-sop-policy-governance-evidence-export",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliation: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt: "rbac-read-write-postgres-local-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt",
          assets: "rbac-read-write-postgres-backend-url-local-object-store",
          devices: "rbac-read-command-postgres-device-bridge-registry-worker-contract",
          deviceBridgeWorker: "token-auth-heartbeat-poll-ack-complete-telemetry-hardening-recovery-audit-replay-export-product-readiness-production-readiness-operations-continuity-fleet-reliability-lifecycle-assurance",
          reports: "rbac-write-postgres",
          observability: "structured-json-logs-redacted-ops-status-runtime-checks",
          audit: "append-only-contract",
        },
        links: {
          openapi: "/openapi.stage4z.json",
          openapiStage4A: "/openapi.stage4a.json",
          openapiStage4B: "/openapi.stage4b.json",
          openapiStage4C: "/openapi.stage4c.json",
          openapiStage4D: "/openapi.stage4d.json",
          openapiStage4G: "/openapi.stage4g.json",
          openapiStage4H: "/openapi.stage4h.json",
          openapiStage4I: "/openapi.stage4i.json",
          openapiStage4J: "/openapi.stage4j.json",
          openapiStage4N: "/openapi.stage4n.json",
          openapiStage4P: "/openapi.stage4p.json",
          openapiStage4Q: "/openapi.stage4q.json",
          openapiStage4R: "/openapi.stage4r.json",
          openapiStage4S: "/openapi.stage4s.json",
          openapiStage4U: "/openapi.stage4u.json",
          openapiStage4V: "/openapi.stage4v.json",
          openapiStage4W: "/openapi.stage4w.json",
          openapiStage4X: "/openapi.stage4x.json",
          openapiStage4Y: "/openapi.stage4y.json",
          openapiStage4Z: "/openapi.stage4z.json",
          openapiStage5H: "/openapi.stage5h.json",
          openapiStage5I: "/openapi.stage5i.json",
          openapiStage5J: "/openapi.stage5j.json",
          openapiStage5K: "/openapi.stage5k.json",
          openapiStage5L: "/openapi.stage5l.json",
          openapiStage5N: "/openapi.stage5n.json",
          openapiStage5O: "/openapi.stage5o.json",
          openapiStage5P: "/openapi.stage5p.json",
          openapiStage5Q: "/openapi.stage5q.json",
          openapiStage5R: "/openapi.stage5r.json",
          openapiStage5S: "/openapi.stage5s.json",
          openapiStage5T: "/openapi.stage5t.json",
          openapiStage8G8I: "/openapi.stage8g-8i.json",
          openapiStage8J8O: "/openapi.stage8j-8o.json",
          openapiStage8P9A: "/openapi.stage8p-9a.json",
          openapiStage9B9M: "/openapi.stage9b-9m.json",
          openapiStage9N9Z: "/openapi.stage9n-9z.json",
          openapiStage17A17Z: "/openapi.stage17a-17z.json",
          openapiStage18A18Z: "/openapi.stage18a-18z.json",
          openapiStage19A19Z: "/openapi.stage19a-19z.json",
          openapiStage20A20Z: "/openapi.stage20a-20z.json",
          openapiStage21A21Z: "/openapi.stage21a-21z.json",
          openapiStage22A22Z: "/openapi.stage22a-22z.json",
          openapiStage23A23Z: "/openapi.stage23a-23z.json",
          openapiStage24A24Z: "/openapi.stage24a-24z.json",
          openapiStage25A25Z: "/openapi.stage25a-25z.json",
          openapiStage26A26Z: "/openapi.stage26a-26z.json",
          openapiStage27A27Z: "/openapi.stage27a-27z.json",
          openapiStage28A28Z: "/openapi.stage28a-28z.json",
          openapiStage29A29Z: "/openapi.stage29a-29z.json",
          openapiStage30A30Z: "/openapi.stage30a-30z.json",
          openapiStage31A31Z: "/openapi.stage31a-31z.json",
          openapiStage32A32Z: "/openapi.stage32a-32z.json",
          openapiStage33A33Z: "/openapi.stage33a-33z.json",
          openapiStage34A34Z: "/openapi.stage34a-34z.json",
          openapiStage35A35Z: "/openapi.stage35a-35z.json",
          openapiStage36A36Z: "/openapi.stage36a-36z.json",
          openapiStage37A37Z: "/openapi.stage37a-37z.json",
          openapiStage38A38Z: "/openapi.stage38a-38z.json",
          openapiStage39A39Z: "/openapi.stage39a-39z.json",
          openapiStage40A40Z: "/openapi.stage40a-40z.json",
          openapiStage41A41Z: "/openapi.stage41a-41z.json",
          openapiStage42A42Z: "/openapi.stage42a-42z.json",
          openapiStage43A43Z: "/openapi.stage43a-43z.json",
          openapiStage44A44Z: "/openapi.stage44a-44z.json",
          openapiStage45A45Z: "/openapi.stage45a-45z.json",
          openapiStage46A46Z: "/openapi.stage46a-46z.json",
          openapiStage47A47Z: "/openapi.stage47a-47z.json",
          login: "/api/v1/auth/login",
          me: "/api/v1/auth/me",
          opsStatus: "/api/v1/ops/status",
          opsRuntimeChecks: "/api/v1/ops/runtime-checks",
          productReadiness: "/api/v1/product/readiness",
          deviceBridges: "/api/v1/device-bridges",
          deviceBridgeCommands: "/api/v1/device-bridges/{bridgeId}/commands",
          deviceBridgeWorkerHeartbeat: "/api/v1/device-bridge-worker/heartbeat",
          deviceBridgeWorkerCommands: "/api/v1/device-bridge-worker/commands",
          deviceBridgeWorkerCommand: "/api/v1/device-bridge-worker/commands/{commandId}",
          deviceBridgeWorkerStatus: "/api/v1/device-bridge-worker/status",
          deviceBridgeWorkerHardening: "/api/v1/device-bridge-worker/hardening",
          deviceBridgeWorkerRecovery: "/api/v1/device-bridge-worker/recovery",
          deviceBridgeWorkerAudit: "/api/v1/device-bridge-worker/audit",
          deviceBridgeWorkerAuditExport: "/api/v1/device-bridge-worker/audit/export",
          deviceBridgeWorkerProductionReadiness: "/api/v1/device-bridge-worker/production-readiness",
          deviceBridgeWorkerOperationsContinuity: "/api/v1/device-bridge-worker/operations-continuity",
          deviceBridgeWorkerFleetReliability: "/api/v1/device-bridge-worker/fleet-reliability",
          deviceBridgeWorkerLifecycleAssurance: "/api/v1/device-bridge-worker/lifecycle-assurance",
          deviceBridgeWorkerReplay: "/api/v1/device-bridge-worker/commands/{commandId}/replay",
          devices: "/api/v1/devices",
          deviceCommands: "/api/v1/devices/{deviceId}/commands",
          patients: "/api/v1/patients",
          visits: "/api/v1/visits",
          patientVisits: "/api/v1/patients/{patientId}/visits",
          doctorDashboard: "/api/v1/doctor/dashboard",
          leadsAppointments: "/api/v1/leads/appointments",
          createLead: "/api/v1/leads",
          updateLeadStatus: "/api/v1/leads/{leadId}",
          bookLeadAppointment: "/api/v1/leads/{leadId}/book-appointment",
          clinicBookingRequests: "/api/v1/clinic/booking-requests",
          clinicBookingRequest: "/api/v1/clinic/booking-requests/{requestId}",
          bookClinicBookingRequestFromSlot: "/api/v1/clinic/booking-requests/{requestId}/book-from-slot",
          externalBookingImports: "/api/v1/integrations/booking-imports",
          externalBookingImportStatus: "/api/v1/integrations/booking-imports/status",
          clinicAvailableSlots: "/api/v1/clinic/available-slots",
          patientPortal: "/api/v1/me/portal",
          patientPortalHistory: "/api/v1/me/history",
          patientPortalReport: "/api/v1/me/reports/{reportId}",
          patientPortalBookingRequests: "/api/v1/me/booking-requests",
          patientPortalReminderPreferences: "/api/v1/me/reminder-preferences",
          clinicalFollowUps: "/api/v1/clinical/follow-ups",
          createVisitFollowUp: "/api/v1/visits/{visitId}/follow-ups",
          clinicalFollowUpMessages: "/api/v1/clinical/follow-ups/{followUpId}/messages",
          clinicalFollowUpOperations: "/api/v1/clinical/follow-ups/operations",
          clinicalFollowUpOperationsSummary: "/api/v1/clinical/follow-ups/operations/summary",
          clinicalFollowUpOperation: "/api/v1/clinical/follow-ups/{followUpId}/operations",
          clinicalFollowUpOutcomesSummary: "/api/v1/clinical/follow-ups/outcomes/summary",
          clinicalFollowUpQuality: "/api/v1/clinical/follow-ups/{followUpId}/quality",
          clinicalFollowUpClinicReviewSummary: "/api/v1/clinical/follow-ups/clinic-review/summary",
          clinicalFollowUpClinicReview: "/api/v1/clinical/follow-ups/{followUpId}/clinic-review",
          clinicalFollowUpSopValidationSummary: "/api/v1/clinical/follow-ups/sop-validation/summary",
          clinicalFollowUpSopValidation: "/api/v1/clinical/follow-ups/{followUpId}/sop-validation",
          clinicalFollowUpSopPolicyTemplatesSummary: "/api/v1/clinical/follow-ups/sop-policy-templates/summary",
          clinicalFollowUpSopPolicyTemplates: "/api/v1/clinical/follow-ups/sop-policy-templates",
          clinicalFollowUpSopPolicyTemplate: "/api/v1/clinical/follow-ups/sop-policy-templates/{templateId}",
          clinicalFollowUpSopPolicyApplicationSummary: "/api/v1/clinical/follow-ups/sop-policy-application/summary",
          clinicalFollowUpSopPolicyApplication: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-application",
          clinicalFollowUpSopPolicyExceptionClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary",
          clinicalFollowUpSopPolicyExceptionClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-exception",
          clinicalFollowUpSopPolicyAuditRollupSummary: "/api/v1/clinical/follow-ups/sop-policy-audit/summary",
          clinicalFollowUpSopPolicyAuditRollup: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-audit",
          clinicalFollowUpSopPolicyGovernanceReadinessSummary: "/api/v1/clinical/follow-ups/sop-policy-governance/summary",
          clinicalFollowUpSopPolicyGovernanceReadiness: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance",
          clinicalFollowUpSopPolicyGovernanceClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary",
          clinicalFollowUpSopPolicyGovernanceClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary",
          clinicalFollowUpSopPolicyGovernanceEvidence: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliation: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary: "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary",
          clinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt: "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt",
          patientPortalFollowUps: "/api/v1/me/follow-ups",
          patientPortalFollowUpMessages: "/api/v1/me/follow-ups/{followUpId}/messages",
          visit: "/api/v1/visits/{visitId}",
          visitLesions: "/api/v1/visits/{visitId}/lesions",
          visitAssets: "/api/v1/visits/{visitId}/assets",
          assetDownloadUrl: "/api/v1/assets/{assetId}/download-url",
          assetDownload: "/api/v1/assets/{assetId}/download",
          visitAssessment: "/api/v1/visits/{visitId}/assessment",
          visitConclusion: "/api/v1/visits/{visitId}/conclusion",
          visitReport: "/api/v1/visits/{visitId}/report",
          visitReportPackage: "/api/v1/visits/{visitId}/report-package",
          lesion: "/api/v1/lesions/{lesionId}",
          health: "/healthz",
          readiness: "/readyz",
        },
        generatedAt: now(),
        correlationId,
      },
      config,
      requestOrigin,
    );
  }

  if (url.pathname === "/openapi.stage4a.json") {
    return jsonResponse(200, OPENAPI_4A, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4b.json") {
    return jsonResponse(200, OPENAPI_4B, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4c.json") {
    return jsonResponse(200, OPENAPI_4C, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4d.json") {
    return jsonResponse(200, OPENAPI_4D, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4g.json") {
    return jsonResponse(200, OPENAPI_4G, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4h.json") {
    return jsonResponse(200, OPENAPI_4H, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4i.json") {
    return jsonResponse(200, OPENAPI_4I, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4j.json") {
    return jsonResponse(200, OPENAPI_4J, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4n.json") {
    return jsonResponse(200, OPENAPI_4N, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4p.json") {
    return jsonResponse(200, OPENAPI_4P, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4q.json") {
    return jsonResponse(200, OPENAPI_4Q, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4r.json") {
    return jsonResponse(200, OPENAPI_4R, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4s.json") {
    return jsonResponse(200, OPENAPI_4S, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4u.json") {
    return jsonResponse(200, OPENAPI_4U, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4v.json") {
    return jsonResponse(200, OPENAPI_4V, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4w.json") {
    return jsonResponse(200, OPENAPI_4W, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4x.json") {
    return jsonResponse(200, OPENAPI_4X, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4y.json") {
    return jsonResponse(200, OPENAPI_4Y, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage4z.json") {
    return jsonResponse(200, OPENAPI_4Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5h.json") {
    return jsonResponse(200, OPENAPI_5H, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5i.json") {
    return jsonResponse(200, OPENAPI_5I, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5j.json") {
    return jsonResponse(200, OPENAPI_5J, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5k.json") {
    return jsonResponse(200, OPENAPI_5K, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5l.json") {
    return jsonResponse(200, OPENAPI_5L, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5n.json") {
    return jsonResponse(200, OPENAPI_5N, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5o.json") {
    return jsonResponse(200, OPENAPI_5O, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5p.json") {
    return jsonResponse(200, OPENAPI_5P, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5q.json") {
    return jsonResponse(200, OPENAPI_5Q, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5r.json") {
    return jsonResponse(200, OPENAPI_5R, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5s.json") {
    return jsonResponse(200, OPENAPI_5S, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage5t.json") {
    return jsonResponse(200, OPENAPI_5T, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage8g-8i.json") {
    return jsonResponse(200, OPENAPI_8G_8I, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage8j-8o.json") {
    return jsonResponse(200, OPENAPI_8J_8O, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage8p-9a.json") {
    return jsonResponse(200, OPENAPI_8P_9A, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage9b-9m.json") {
    return jsonResponse(200, OPENAPI_9B_9M, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage9n-9z.json") {
    return jsonResponse(200, OPENAPI_9N_9Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage17a-17z.json") {
    return jsonResponse(200, OPENAPI_17A_17Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage18a-18z.json") {
    return jsonResponse(200, OPENAPI_18A_18Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage19a-19z.json") {
    return jsonResponse(200, OPENAPI_19A_19Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage20a-20z.json") {
    return jsonResponse(200, OPENAPI_20A_20Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage21a-21z.json") {
    return jsonResponse(200, OPENAPI_21A_21Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage22a-22z.json") {
    return jsonResponse(200, OPENAPI_22A_22Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage23a-23z.json") {
    return jsonResponse(200, OPENAPI_23A_23Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage24a-24z.json") {
    return jsonResponse(200, OPENAPI_24A_24Z, config, requestOrigin);
  }
  if (url.pathname === "/openapi.stage25a-25z.json") {
    return jsonResponse(200, OPENAPI_25A_25Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage26a-26z.json") {
    return jsonResponse(200, OPENAPI_26A_26Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage27a-27z.json") {
    return jsonResponse(200, OPENAPI_27A_27Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage28a-28z.json") {
    return jsonResponse(200, OPENAPI_28A_28Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage29a-29z.json") {
    return jsonResponse(200, OPENAPI_29A_29Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage30a-30z.json") {
    return jsonResponse(200, OPENAPI_30A_30Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage31a-31z.json") {
    return jsonResponse(200, OPENAPI_31A_31Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage32a-32z.json") {
    return jsonResponse(200, OPENAPI_32A_32Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage33a-33z.json") {
    return jsonResponse(200, OPENAPI_33A_33Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage34a-34z.json") {
    return jsonResponse(200, OPENAPI_34A_34Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage35a-35z.json") {
    return jsonResponse(200, OPENAPI_35A_35Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage36a-36z.json") {
    return jsonResponse(200, OPENAPI_36A_36Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage37a-37z.json") {
    return jsonResponse(200, OPENAPI_37A_37Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage38a-38z.json") {
    return jsonResponse(200, OPENAPI_38A_38Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage39a-39z.json") {
    return jsonResponse(200, OPENAPI_39A_39Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage40a-40z.json") {
    return jsonResponse(200, OPENAPI_40A_40Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage41a-41z.json") {
    return jsonResponse(200, OPENAPI_41A_41Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage42a-42z.json") {
    return jsonResponse(200, OPENAPI_42A_42Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage43a-43z.json") {
    return jsonResponse(200, OPENAPI_43A_43Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage44a-44z.json") {
    return jsonResponse(200, OPENAPI_44A_44Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage45a-45z.json") {
    return jsonResponse(200, OPENAPI_45A_45Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage46a-46z.json") {
    return jsonResponse(200, OPENAPI_46A_46Z, config, requestOrigin);
  }

  if (url.pathname === "/openapi.stage47a-47z.json") {
    return jsonResponse(200, OPENAPI_47A_47Z, config, requestOrigin);
  }

  return errorResponse({
    status: 404,
    code: "not_found",
    message: "No Stage 5T self-hosted backend route matched the request.",
    correlationId,
    config,
    requestOrigin,
  });
}

function internalErrorResponse(config, requestOrigin, correlationId) {
  return errorResponse({
    status: 500,
    code: "internal_error",
    message: "The self-hosted backend could not complete the request.",
    correlationId,
    config,
    requestOrigin,
  });
}

function readNodeRequestBody(req, maxBytes = 64_000) {
  return new Promise((resolve, reject) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(String(req.method || "").toUpperCase())) {
      resolve("");
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function requestBodyLimitFor(req) {
  const method = String(req.method || "").toUpperCase();
  const url = String(req.url || "");
  if (method === "POST" && /^\/api\/v1\/visits\/[^/]+\/assets(?:\?|$)/.test(url)) {
    return LARGE_JSON_BODY_LIMIT_BYTES;
  }
  return 64_000;
}

export function createNodeHandler(config, { logger = null } = {}) {
  return async (req, res) => {
    const started = Date.now();
    let response;
    const fallbackCorrelationId = req.headers?.["x-correlation-id"] || "stage4n-local";
    try {
      const body = await readNodeRequestBody(req, requestBodyLimitFor(req));
      response = await handleSelfHostedRequest(
        {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
        },
        config,
      );
    } catch {
      response = internalErrorResponse(
        config,
        req.headers?.origin || "",
        fallbackCorrelationId,
      );
    }
    if (logger) {
      logger.info("http.request", {
        method: String(req.method || "GET").toUpperCase(),
        path: safeRequestPath(req.url),
        status: response.status,
        durationMs: Date.now() - started,
        correlationId: extractCorrelationId(response, fallbackCorrelationId),
      });
    }
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
}
