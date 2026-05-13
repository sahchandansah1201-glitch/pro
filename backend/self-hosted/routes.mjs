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
import {
  createPatientRepository,
  parsePatientListParams,
} from "./patients-repository.mjs";
import {
  assertUuid,
  createPatientWriteService,
} from "./patient-write-service.mjs";
import { patientReadScope, visitReadScope } from "./rbac.mjs";
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
  const patientWriteService =
    runtime.patientWriteService ||
    createPatientWriteService({
      patientRepository,
      auditRepository,
    });
  const visitWorkspaceRepository =
    runtime.visitWorkspaceRepository || createVisitWorkspaceRepository(dbClient);
  return {
    auditRepository,
    authRepository,
    authService,
    dbClient,
    patientRepository,
    patientWriteService,
    visitWorkspaceRepository,
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
    patient_not_found: "Patient was not found in the allowed clinic scope.",
    visit_not_found: "Visit was not found in the allowed clinic scope.",
    invalid_uuid: "The supplied identifier is not a valid UUID.",
    validation_error: "Patient payload failed validation.",
  };
  if (error instanceof DatabaseConfigError || error?.publicCode) {
    const code = error.publicCode || "database_unavailable";
    return {
      status: error.publicStatus || 503,
      code,
      message: messages[code] || "The self-hosted backend could not complete the request.",
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
    "stage4d-local";

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

  if (method !== "GET") {
    return errorResponse({
      status: 405,
      code: "method_not_allowed",
      message: "This self-hosted backend route does not allow the requested method in Stage 4D.",
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
        stage: "4D",
        deploymentMode: config.deploymentMode,
        service: publicConfig(config),
        capabilities: {
          auth: "local-jwt",
          patients: "rbac-read-write-postgres",
          visits: "rbac-read-postgres",
          lesions: "rbac-read-postgres",
          assets: "rbac-read-metadata-postgres",
          audit: "append-only-contract",
        },
        links: {
          openapi: "/openapi.stage4d.json",
          openapiStage4A: "/openapi.stage4a.json",
          openapiStage4B: "/openapi.stage4b.json",
          openapiStage4C: "/openapi.stage4c.json",
          openapiStage4D: "/openapi.stage4d.json",
          openapiStage4G: "/openapi.stage4g.json",
          login: "/api/v1/auth/login",
          me: "/api/v1/auth/me",
          patients: "/api/v1/patients",
          patientVisits: "/api/v1/patients/{patientId}/visits",
          visit: "/api/v1/visits/{visitId}",
          visitLesions: "/api/v1/visits/{visitId}/lesions",
          visitAssets: "/api/v1/visits/{visitId}/assets",
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

  return errorResponse({
    status: 404,
    code: "not_found",
    message: "No Stage 4D self-hosted backend route matched the request.",
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

export function createNodeHandler(config) {
  return async (req, res) => {
    let response;
    try {
      const body = await readNodeRequestBody(req);
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
        req.headers?.["x-correlation-id"] || "stage4d-local",
      );
    }
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
}
