// Stage 4O · Self-hosted operations status client.
// Calls only the local self-hosted backend. No managed runtime coupling.

import {
  buildSelfHostedApiUrl,
  type SelfHostedApiError,
  type SelfHostedApiResult,
} from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface SelfHostedOpsDependency {
  name: string;
  configured: boolean;
  connected: boolean;
  status: string;
}

export interface SelfHostedOpsStatus {
  stage: "4N" | string;
  source: "self-hosted" | string;
  ready: boolean;
  status: "ready" | "degraded" | string;
  dependencies: SelfHostedOpsDependency[];
  observability: {
    structuredJsonLogs: boolean;
    correlationHeader: string;
    redaction: string;
    requestPathLogging: string;
  };
  audit: {
    mode: string;
    safeExport: string;
    exportedFields: string[];
  };
  auth: {
    userId: string;
    roles: string[];
  };
  generatedAt: string;
  correlationId: string;
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function ensureConfigured(args: BaseArgs): SelfHostedApiError | null {
  if (!args.apiToken) return NOT_CONFIGURED;
  if (!args.apiBaseUrl) {
    return {
      kind: "validation",
      code: "base_url_required",
      message: "Укажите адрес self-hosted backend.",
    };
  }
  return null;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const wrapper = isRecord(body) && isRecord(body.error) ? body.error : null;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: typeof wrapper?.code === "string" ? wrapper.code : `http_${response.status}`,
    message: typeof wrapper?.message === "string" ? wrapper.message : `HTTP ${response.status}`,
    correlationId: isRecord(body) && typeof body.correlationId === "string" ? body.correlationId : undefined,
  };
}

function toStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];
}

function toDependency(input: unknown): SelfHostedOpsDependency | null {
  if (!isRecord(input)) return null;
  const name = typeof input.name === "string" ? input.name : "";
  if (!name) return null;
  return {
    name,
    configured: Boolean(input.configured),
    connected: Boolean(input.connected),
    status: typeof input.status === "string" ? input.status : "unknown",
  };
}

export function toSelfHostedOpsStatus(input: unknown): SelfHostedOpsStatus | null {
  if (!isRecord(input)) return null;
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "self-hosted",
    ready: Boolean(input.ready),
    status: typeof input.status === "string" ? input.status : "unknown",
    dependencies: Array.isArray(input.dependencies)
      ? input.dependencies.map(toDependency).filter((item): item is SelfHostedOpsDependency => item != null)
      : [],
    observability: {
      structuredJsonLogs: Boolean(isRecord(input.observability) && input.observability.structuredJsonLogs),
      correlationHeader:
        isRecord(input.observability) && typeof input.observability.correlationHeader === "string"
          ? input.observability.correlationHeader
          : "x-correlation-id",
      redaction:
        isRecord(input.observability) && typeof input.observability.redaction === "string"
          ? input.observability.redaction
          : "unknown",
      requestPathLogging:
        isRecord(input.observability) && typeof input.observability.requestPathLogging === "string"
          ? input.observability.requestPathLogging
          : "unknown",
    },
    audit: {
      mode: isRecord(input.audit) && typeof input.audit.mode === "string" ? input.audit.mode : "unknown",
      safeExport:
        isRecord(input.audit) && typeof input.audit.safeExport === "string"
          ? input.audit.safeExport
          : "scripts/stage4n-audit-export.mjs --dry-run",
      exportedFields: isRecord(input.audit) ? toStringArray(input.audit.exportedFields) : [],
    },
    auth: {
      userId: isRecord(input.auth) && typeof input.auth.userId === "string" ? input.auth.userId : "",
      roles: isRecord(input.auth) ? toStringArray(input.auth.roles) : [],
    },
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
  };
}

export async function fetchSelfHostedOpsStatus(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedOpsStatus>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);

  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/ops/status"), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.apiToken}`,
      },
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }

  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  const value = toSelfHostedOpsStatus(body);
  return value
    ? ok(value)
    : fail({
        kind: "http",
        code: "empty_response",
        message: "Backend не вернул ops status.",
      });
}

export const STAGE4O_AUDIT_EXPORT_COMMAND =
  "npm run ops:stage4n:audit-export:dry-run";

export function buildStage4OAuditExportPreview(status: SelfHostedOpsStatus | null): string {
  const fields = status?.audit.exportedFields?.length
    ? status.audit.exportedFields
    : ["created_at", "action", "entity_type", "entity_id", "correlation_id"];
  return [
    "# Stage 4O audit export preview",
    "",
    `- Command: ${STAGE4O_AUDIT_EXPORT_COMMAND}`,
    `- Backend contract: ${status?.audit.safeExport ?? "scripts/stage4n-audit-export.mjs --dry-run"}`,
    `- Safe columns: ${fields.join(", ")}`,
    "- Excluded: request bodies, tokens, passwords, patient names, object keys, storage paths, raw env values",
    "",
  ].join("\n");
}
