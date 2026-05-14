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
import { createDeviceBridgeWorkerRepository } from "./device-bridge-worker-repository.mjs";
import { createDeviceBridgeWorkerService } from "./device-bridge-worker-service.mjs";
import {
  createDeviceRegistryRepository,
  parseDeviceRegistryParams,
} from "./device-registry-repository.mjs";
import {
  createPatientRepository,
  parsePatientListParams,
} from "./patients-repository.mjs";
import {
  assertUuid,
  createPatientWriteService,
} from "./patient-write-service.mjs";
import { createAssetWriteRepository } from "./asset-write-repository.mjs";
import {
  createAssetWriteService,
  normalizeDownloadUrlParams,
} from "./asset-write-service.mjs";
import { createLocalObjectStore } from "./object-store.mjs";
import { extractCorrelationId, safeRequestPath } from "./ops-logger.mjs";
import { collectSelfHostedOpsRuntimeChecks } from "./ops-runtime-checks.mjs";
import { deviceReadScope, opsStatusScope, patientReadScope, visitReadScope } from "./rbac.mjs";
import { createVisitWorkspaceRepository } from "./visit-workspace-repository.mjs";
import { createVisitWorkspaceWriteRepository } from "./visit-workspace-write-repository.mjs";
import { createVisitWorkspaceWriteService } from "./visit-workspace-write-service.mjs";

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
  const patientWriteService =
    runtime.patientWriteService ||
    createPatientWriteService({
      patientRepository,
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
  const assetWriteRepository =
    runtime.assetWriteRepository || createAssetWriteRepository(dbClient);
  const objectStore = runtime.objectStore || createLocalObjectStore(config);
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
    dbClient,
    deviceBridgeCommandRepository,
    deviceBridgeCommandService,
    deviceBridgeWorkerRepository,
    deviceBridgeWorkerService,
    deviceRegistryRepository,
    patientRepository,
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
    visit_not_found: "Visit was not found in the allowed clinic scope.",
    lesion_not_found: "Lesion was not found in the allowed clinic scope.",
    command_not_found: "Device Bridge command was not found for this worker bridge.",
    not_found: "Resource was not found in the allowed clinic scope.",
    invalid_uuid: "The supplied identifier is not a valid UUID.",
    validation_error: "Request payload failed validation.",
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

  const visitReportMatch = url.pathname.match(/^\/api\/v1\/visits\/([^/]+)\/report$/);
  if (visitReportMatch && method === "PATCH") {
    try {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.visitWorkspaceWriteService.updateReport(
        decodeURIComponent(visitReportMatch[1]),
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "4H",
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

  if (method !== "GET") {
    return errorResponse({
      status: 405,
      code: "method_not_allowed",
      message: "This self-hosted backend route does not allow the requested method in Stage 4S.",
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
        stage: "4S",
        deploymentMode: config.deploymentMode,
        service: publicConfig(config),
        capabilities: {
          auth: "local-jwt",
          patients: "rbac-read-write-postgres",
          visits: "rbac-read-write-postgres",
          lesions: "rbac-read-write-postgres",
          assets: "rbac-read-write-postgres-backend-url-local-object-store",
          devices: "rbac-read-command-postgres-device-bridge-registry-worker-contract",
          deviceBridgeWorker: "token-auth-heartbeat-poll-ack-complete",
          reports: "rbac-write-postgres",
          observability: "structured-json-logs-redacted-ops-status-runtime-checks",
          audit: "append-only-contract",
        },
        links: {
          openapi: "/openapi.stage4s.json",
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
          login: "/api/v1/auth/login",
          me: "/api/v1/auth/me",
          opsStatus: "/api/v1/ops/status",
          opsRuntimeChecks: "/api/v1/ops/runtime-checks",
          deviceBridges: "/api/v1/device-bridges",
          deviceBridgeCommands: "/api/v1/device-bridges/{bridgeId}/commands",
          deviceBridgeWorkerHeartbeat: "/api/v1/device-bridge-worker/heartbeat",
          deviceBridgeWorkerCommands: "/api/v1/device-bridge-worker/commands",
          deviceBridgeWorkerCommand: "/api/v1/device-bridge-worker/commands/{commandId}",
          devices: "/api/v1/devices",
          deviceCommands: "/api/v1/devices/{deviceId}/commands",
          patients: "/api/v1/patients",
          patientVisits: "/api/v1/patients/{patientId}/visits",
          visit: "/api/v1/visits/{visitId}",
          visitLesions: "/api/v1/visits/{visitId}/lesions",
          visitAssets: "/api/v1/visits/{visitId}/assets",
          assetDownloadUrl: "/api/v1/assets/{assetId}/download-url",
          assetDownload: "/api/v1/assets/{assetId}/download",
          visitReport: "/api/v1/visits/{visitId}/report",
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

  return errorResponse({
    status: 404,
    code: "not_found",
    message: "No Stage 4S self-hosted backend route matched the request.",
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
