const DEFAULT_ALLOWED_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function corsHeaders(config, requestOrigin = "") {
  const allowedOrigin = config.corsOrigins.includes(requestOrigin)
    ? requestOrigin
    : config.corsOrigins[0] ?? "http://localhost:8080";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": DEFAULT_ALLOWED_METHODS,
    "access-control-allow-headers": "content-type,authorization,x-correlation-id",
    "vary": "origin",
  };
}

export function jsonResponse(status, body, config, requestOrigin) {
  const correlationId = body && typeof body === "object" ? body.correlationId : null;
  return {
    status,
    headers: {
      ...JSON_HEADERS,
      ...(correlationId ? { "x-correlation-id": String(correlationId) } : {}),
      ...corsHeaders(config, requestOrigin),
    },
    body: JSON.stringify(body),
  };
}

export function errorResponse({
  status,
  code,
  message,
  correlationId,
  config,
  requestOrigin,
  details,
}) {
  return jsonResponse(
    status,
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      correlationId,
    },
    config,
    requestOrigin,
  );
}

export function notImplementedResponse({
  capability,
  correlationId,
  config,
  requestOrigin,
}) {
  return errorResponse({
    status: 501,
    code: "not_implemented",
    message: `${capability} is contract-only in the current self-hosted stage.`,
    correlationId,
    config,
    requestOrigin,
  });
}
