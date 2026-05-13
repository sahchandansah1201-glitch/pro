// Stage 4I · Self-hosted clinical asset API adapter.
// Mirrors the safe DTO shape used by the Imaging UI while calling the local
// backend /api/v1 assets contract. No managed-runtime coupling.

import type {
  AssetsApiError,
  AssetsApiResult,
  SafeAssetDTO,
  SignedDownloadDTO,
} from "@/lib/clinical-assets-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  token: string | null | undefined;
  baseUrl: string | null | undefined;
}

export interface ListSelfHostedVisitAssetsArgs extends BaseArgs {
  visitId: string;
}

export interface UploadSelfHostedVisitAssetArgs extends BaseArgs {
  visitId: string;
  file: File;
  kind: SafeAssetDTO["kind"];
  source: SafeAssetDTO["source"];
  lesionId?: string | null;
  capturedAt?: string;
  signal?: AbortSignal;
}

export interface GetSelfHostedAssetDownloadUrlArgs extends BaseArgs {
  assetId: string;
  expiresIn?: number;
}

const NOT_CONFIGURED: AssetsApiError = {
  kind: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

function ok<T>(value: T): AssetsApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: AssetsApiError): AssetsApiResult<T> {
  return { ok: false, value: null, error };
}

function ensureConfigured(args: BaseArgs): AssetsApiError | null {
  return args.token && args.baseUrl ? null : NOT_CONFIGURED;
}

function authHeaders(token: string): HeadersInit {
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
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

function apiErrorFromBody(response: Response, body: unknown): AssetsApiError {
  const wrapper = isRecord(body) && isRecord(body.error) ? body.error : null;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    message: String(wrapper?.message ?? `HTTP ${response.status}`),
  };
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<AssetsApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return fail({
      kind: "network",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  return ok(body);
}

async function requestBlob(
  url: string,
  init: RequestInit,
): Promise<AssetsApiResult<Blob>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return fail({
      kind: "network",
      message: "Сбой сети при загрузке снимка из self-hosted backend.",
    });
  }
  if (!response.ok) {
    const body = await parseJsonSafe(response);
    return fail(apiErrorFromBody(response, body));
  }
  return ok(await response.blob());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer =
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer();
  return bytesToBase64(new Uint8Array(arrayBuffer));
}

function frontendKind(kind: unknown): SafeAssetDTO["kind"] {
  if (kind === "dermoscopy") return "dermoscopy";
  if (kind === "report_attachment") return "macro";
  return "overview";
}

function backendKind(kind: SafeAssetDTO["kind"]): string {
  if (kind === "dermoscopy") return "dermoscopy";
  return "overview_photo";
}

function toSafeAssetDTO(input: Record<string, unknown>): SafeAssetDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: String(input.clinicId ?? ""),
    visitId: String(input.visitId ?? ""),
    lesionId: input.lesionId == null ? null : String(input.lesionId),
    kind: frontendKind(input.kind),
    source: "file",
    capturedAt: String(input.capturedAt ?? input.createdAt ?? ""),
    deviceId: null,
    qualityScore: 1,
    qualityIssues: [],
    createdAt: String(input.createdAt ?? ""),
  };
}

function extractItems(body: unknown): Record<string, unknown>[] {
  return isRecord(body) && Array.isArray(body.items)
    ? body.items.filter(isRecord)
    : [];
}

function extractItem(body: unknown): Record<string, unknown> | null {
  return isRecord(body) && isRecord(body.item) ? body.item : null;
}

export async function listSelfHostedVisitAssets(
  args: ListSelfHostedVisitAssetsArgs,
): Promise<AssetsApiResult<SafeAssetDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.visitId) {
    return fail({ kind: "validation", message: "visitId обязателен." });
  }
  const url = buildSelfHostedApiUrl(
    args.baseUrl,
    `/api/v1/visits/${encodeURIComponent(args.visitId)}/assets`,
  );
  const result = await requestJson(url, {
    method: "GET",
    headers: authHeaders(args.token as string),
  });
  if (!result.ok) return fail(result.error as AssetsApiError);
  return ok(extractItems(result.value).map(toSafeAssetDTO).filter((asset) => asset.id));
}

export async function uploadSelfHostedVisitAsset(
  args: UploadSelfHostedVisitAssetArgs,
): Promise<AssetsApiResult<SafeAssetDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.visitId || !args.file) {
    return fail({ kind: "validation", message: "visitId и file обязательны." });
  }
  const url = buildSelfHostedApiUrl(
    args.baseUrl,
    `/api/v1/visits/${encodeURIComponent(args.visitId)}/assets`,
  );
  const dataBase64 = await fileToBase64(args.file);
  const result = await requestJson(url, {
    method: "POST",
    headers: {
      ...authHeaders(args.token as string),
      "Content-Type": "application/json",
    },
    signal: args.signal,
    body: JSON.stringify({
      kind: backendKind(args.kind),
      contentType: args.file.type || "application/octet-stream",
      byteSize: args.file.size,
      dataBase64,
      originalFileName: args.file.name,
      lesionId: args.lesionId ?? null,
      capturedAt: args.capturedAt ?? new Date().toISOString(),
    }),
  });
  if (!result.ok) return fail(result.error as AssetsApiError);
  const item = extractItem(result.value);
  return item
    ? ok(toSafeAssetDTO(item))
    : fail({ kind: "http", message: "Backend вернул пустой ответ." });
}

export async function getSelfHostedAssetDownloadUrl(
  args: GetSelfHostedAssetDownloadUrlArgs,
): Promise<AssetsApiResult<SignedDownloadDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.assetId) {
    return fail({ kind: "validation", message: "assetId обязателен." });
  }
  const qs = args.expiresIn ? `?expiresIn=${encodeURIComponent(String(args.expiresIn))}` : "";
  const url = buildSelfHostedApiUrl(
    args.baseUrl,
    `/api/v1/assets/${encodeURIComponent(args.assetId)}/download-url${qs}`,
  );
  const result = await requestJson(url, {
    method: "GET",
    headers: authHeaders(args.token as string),
  });
  if (!result.ok) return fail(result.error as AssetsApiError);
  const item = extractItem(result.value);
  if (!item) return fail({ kind: "http", message: "Backend вернул пустую ссылку." });
  const rawUrl = String(item.downloadUrl ?? "");
  const downloadUrl = rawUrl.startsWith("/")
    ? buildSelfHostedApiUrl(args.baseUrl, rawUrl)
    : rawUrl;
  const blobResult = await requestBlob(downloadUrl, {
    method: "GET",
    headers: authHeaders(args.token as string),
  });
  if (!blobResult.ok) return fail(blobResult.error as AssetsApiError);
  const objectUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(blobResult.value as Blob)
      : downloadUrl;
  return ok({
    assetId: String(item.assetId ?? args.assetId),
    clinicId: String(item.clinicId ?? ""),
    visitId: String(item.visitId ?? ""),
    downloadUrl: objectUrl,
    expiresIn: Number(item.expiresIn ?? 0),
    expiresAt: String(item.expiresAt ?? ""),
  });
}
