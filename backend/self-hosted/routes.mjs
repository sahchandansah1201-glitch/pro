import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  publicConfig,
  readinessStatus,
} from "./config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OPENAPI = JSON.parse(
  readFileSync(join(HERE, "openapi.stage4a.json"), "utf8"),
);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function corsHeaders(config, requestOrigin = "") {
  const allowedOrigin = config.corsOrigins.includes(requestOrigin)
    ? requestOrigin
    : config.corsOrigins[0] ?? "http://localhost:8080";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-correlation-id",
    "vary": "origin",
  };
}

function json(status, body, config, requestOrigin) {
  return {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(config, requestOrigin),
    },
    body: JSON.stringify(body),
  };
}

export function handleSelfHostedRequest(
  request,
  config,
  now = () => new Date().toISOString(),
) {
  const method = String(request.method || "GET").toUpperCase();
  const url = new URL(request.url || "/", "http://self-hosted.local");
  const requestOrigin = request.headers?.origin || "";
  const correlationId =
    request.headers?.["x-correlation-id"] ||
    request.headers?.["X-Correlation-Id"] ||
    "stage4a-local";

  if (method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders(config, requestOrigin),
      body: "",
    };
  }

  if (method !== "GET") {
    return json(
      405,
      {
        error: "method_not_allowed",
        message: "Stage 4A foundation exposes read-only health and contract endpoints.",
        correlationId,
      },
      config,
      requestOrigin,
    );
  }

  if (url.pathname === "/healthz") {
    return json(
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
    const readiness = readinessStatus(config);
    return json(
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
    return json(
      200,
      {
        apiVersion: "v1",
        stage: "4A",
        deploymentMode: config.deploymentMode,
        service: publicConfig(config),
        capabilities: {
          auth: "contract",
          patients: "contract",
          visits: "contract",
          assets: "contract",
          audit: "append-only-contract",
        },
        links: {
          openapi: "/openapi.stage4a.json",
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
    return json(200, OPENAPI, config, requestOrigin);
  }

  return json(
    404,
    {
      error: "not_found",
      message: "No Stage 4A self-hosted backend route matched the request.",
      correlationId,
    },
    config,
    requestOrigin,
  );
}

export function createNodeHandler(config) {
  return (req, res) => {
    const response = handleSelfHostedRequest(
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
      config,
    );
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
}
