import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  notImplementedResponse,
} from "./api-response.mjs";
import {
  dependencyStatus,
  publicConfig,
} from "./config.mjs";
import { createPostgresClient, DatabaseConfigError } from "./db-client.mjs";
import {
  createPatientRepository,
  parsePatientListParams,
} from "./patients-repository.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OPENAPI_4A = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4a.json"), "utf8"),
);
const OPENAPI_4B = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4b.json"), "utf8"),
);

function getRuntime(config, runtime = {}) {
  const dbClient = runtime.dbClient || createPostgresClient(config);
  const patientRepository =
    runtime.patientRepository || createPatientRepository(dbClient);
  return {
    dbClient,
    patientRepository,
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
  if (error instanceof DatabaseConfigError || error?.publicCode) {
    return {
      status: error.publicStatus || 503,
      code: error.publicCode || "database_unavailable",
      message:
        error.publicCode === "database_not_configured"
          ? "Database is not configured for the self-hosted backend."
          : "Database is unavailable for the self-hosted backend.",
    };
  }

  return {
    status: 500,
    code: "internal_error",
    message: "The self-hosted backend could not complete the request.",
  };
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
    "stage4b-local";

  if (method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders(config, requestOrigin),
      body: "",
    };
  }

  if (url.pathname === "/api/v1/patients" && method === "POST") {
    return notImplementedResponse({
      capability: "Patient creation",
      correlationId,
      config,
      requestOrigin,
    });
  }

  if (url.pathname.startsWith("/api/v1/patients/")) {
    return notImplementedResponse({
      capability: "Patient detail mutations",
      correlationId,
      config,
      requestOrigin,
    });
  }

  if (method !== "GET") {
    return errorResponse({
      status: 405,
      code: "method_not_allowed",
      message: "This self-hosted backend route is read-only in Stage 4B.",
      correlationId,
      config,
      requestOrigin,
    });
  }

  if (url.pathname === "/api/v1/patients") {
    try {
      const result = await runtimeServices.patientRepository.listPatients(
        parsePatientListParams(url.searchParams),
      );
      return jsonResponse(
        200,
        {
          stage: "4B",
          ...result,
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

  if (url.pathname === "/api/v1/auth/login") {
    return notImplementedResponse({
      capability: "Local authentication",
      correlationId,
      config,
      requestOrigin,
    });
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
        stage: "4B",
        deploymentMode: config.deploymentMode,
        service: publicConfig(config),
        capabilities: {
          auth: "contract",
          patients: "read-only-postgres",
          visits: "contract",
          assets: "contract",
          audit: "append-only-contract",
        },
        links: {
          openapi: "/openapi.stage4b.json",
          openapiStage4A: "/openapi.stage4a.json",
          patients: "/api/v1/patients",
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

  return errorResponse({
    status: 404,
    code: "not_found",
    message: "No Stage 4B self-hosted backend route matched the request.",
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

export function createNodeHandler(config) {
  return async (req, res) => {
    let response;
    try {
      response = await handleSelfHostedRequest(
        {
          method: req.method,
          url: req.url,
          headers: req.headers,
        },
        config,
      );
    } catch {
      response = internalErrorResponse(
        config,
        req.headers?.origin || "",
        req.headers?.["x-correlation-id"] || "stage4b-local",
      );
    }
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
}
