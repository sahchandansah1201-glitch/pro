import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type PublicAnalysisStatus = "valid" | "expired" | "not_found";

export interface SelfHostedPublicAnalysisView {
  status: PublicAnalysisStatus;
  safeSummary?: string | null;
  createdAt?: string | null;
  clinicName?: string | null;
  qualityPassed?: boolean | null;
  expiresAt?: string | null;
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Система клиники не подключена.",
};

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody = isRecord(body) && isRecord(body.error) ? body.error : {};
  return {
    kind: "http",
    status: response.status,
    code: String(errorBody.code ?? `http_${response.status}`),
    message: String(errorBody.message ?? `HTTP ${response.status}`),
  };
}

function normalizePublicAnalysis(input: unknown): SelfHostedPublicAnalysisView {
  const source = isRecord(input) ? input : {};
  const rawStatus = source.status === "valid" || source.status === "expired" ? source.status : "not_found";
  return {
    status: rawStatus,
    safeSummary: source.safeSummary == null ? null : String(source.safeSummary),
    createdAt: source.createdAt == null ? null : String(source.createdAt),
    clinicName: source.clinicName == null ? null : String(source.clinicName),
    qualityPassed: source.qualityPassed == null ? null : Boolean(source.qualityPassed),
    expiresAt: source.expiresAt == null ? null : String(source.expiresAt),
  };
}

export async function getSelfHostedPublicAnalysis(args: {
  apiBaseUrl: string | null | undefined;
  token: string;
}): Promise<SelfHostedApiResult<SelfHostedPublicAnalysisView>> {
  if (!args.apiBaseUrl) return fail(NOT_CONFIGURED);

  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/public/analysis/${encodeURIComponent(args.token)}`),
      { headers: { Accept: "application/json" } },
    );
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Система клиники временно недоступна.",
    });
  }

  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  const item = isRecord(body) ? body.item : null;
  return ok(normalizePublicAnalysis(item));
}
