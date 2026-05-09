// Stage 1E-E · Frontend adapter for the clinical assets API.
//
// This module is the ONLY place in the frontend that talks to the
// Stage 1E backend (api-read / api-write edge functions). Doctor pages
// import the typed helpers from here and must NOT call the network
// directly — see scripts/forbidden-patterns.mjs and the doctor hygiene
// scan/tests for the enforced rules.
//
// Safety rules baked into this module:
//   * Response DTOs are STRICTLY allow-listed — no spread of raw rows.
//   * Raw object paths and EXIF blobs are never returned, never typed,
//     and never logged. Only the safe DTOs below leave this file.
//   * If the caller does not provide an auth token we return a typed
//     "not_configured" error instead of trying browser storage.
//   * Endpoint paths mirror the backend contract verbatim.
//
// Endpoints:
//   GET  {base}/functions/v1/api-read/doctor/visits/:visitId/assets
//   POST {base}/functions/v1/api-write/doctor/visits/:visitId/assets/upload
//   GET  {base}/functions/v1/api-read/doctor/assets/:assetId/download-url

/** Minimal asset projection consumed by the doctor UI. */
export interface SafeAssetDTO {
  id: string;
  clinicId: string;
  visitId: string;
  lesionId: string | null;
  kind: "overview" | "dermoscopy" | "macro" | "body_map";
  source: "phone" | "file" | "camera" | "device_bridge" | "local_transfer";
  capturedAt: string;
  deviceId: string | null;
  qualityScore: number;
  qualityIssues: string[];
  createdAt: string;
}

/** Signed download response — only what the UI needs to open a file. */
export interface SignedDownloadDTO {
  assetId: string;
  clinicId: string;
  visitId: string;
  downloadUrl: string;
  expiresIn: number;
  expiresAt: string;
}

export type AssetsApiErrorKind =
  | "not_configured"
  | "network"
  | "http"
  | "validation";

export interface AssetsApiError {
  kind: AssetsApiErrorKind;
  message: string;
  /** HTTP status when kind === "http". */
  status?: number;
}

export type AssetsApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AssetsApiError };

interface BaseArgs {
  /** Bearer JWT for the api-read / api-write surfaces. */
  token: string | null | undefined;
  /** Origin of the Supabase project (e.g. https://xxx.supabase.co). */
  baseUrl: string | null | undefined;
}

export interface ListVisitAssetsArgs extends BaseArgs {
  visitId: string;
}

export interface UploadVisitAssetArgs extends BaseArgs {
  visitId: string;
  file: File;
  kind: SafeAssetDTO["kind"];
  source: SafeAssetDTO["source"];
  lesionId?: string | null;
  capturedAt?: string;
  deviceId?: string | null;
}

export interface GetAssetDownloadUrlArgs extends BaseArgs {
  assetId: string;
  /** Server validates the range (60..900). Default left to the server. */
  expiresIn?: number;
}

const NOT_CONFIGURED: AssetsApiError = {
  kind: "not_configured",
  message: "API клинических ассетов не сконфигурирован для текущей сессии.",
};

function ensureConfigured(args: BaseArgs): AssetsApiError | null {
  if (!args.token || !args.baseUrl) return NOT_CONFIGURED;
  return null;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/** Build the canonical api-read URL for a path. Exported for tests. */
export function buildApiReadUrl(base: string, path: string): string {
  return joinUrl(base, `/functions/v1/api-read${path}`);
}

/** Build the canonical api-write URL for a path. Exported for tests. */
export function buildApiWriteUrl(base: string, path: string): string {
  return joinUrl(base, `/functions/v1/api-write${path}`);
}

/** Strict allow-listed mapping. Drops anything not in the safe set. */
export function toSafeAssetDTO(input: Record<string, unknown>): SafeAssetDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: String(input.clinicId ?? ""),
    visitId: String(input.visitId ?? ""),
    lesionId: (input.lesionId as string | null) ?? null,
    kind: input.kind as SafeAssetDTO["kind"],
    source: input.source as SafeAssetDTO["source"],
    capturedAt: String(input.capturedAt ?? ""),
    deviceId: (input.deviceId as string | null) ?? null,
    qualityScore: Number(input.qualityScore ?? 0),
    qualityIssues: Array.isArray(input.qualityIssues)
      ? (input.qualityIssues as unknown[]).map((s) => String(s))
      : [],
    createdAt: String(input.createdAt ?? ""),
  };
}

/** Strict allow-listed mapping. Drops anything not in the safe set. */
export function toSignedDownloadDTO(input: Record<string, unknown>): SignedDownloadDTO {
  return {
    assetId: String(input.assetId ?? ""),
    clinicId: String(input.clinicId ?? ""),
    visitId: String(input.visitId ?? ""),
    downloadUrl: String(input.downloadUrl ?? ""),
    expiresIn: Number(input.expiresIn ?? 0),
    expiresAt: String(input.expiresAt ?? ""),
  };
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function request(
  url: string,
  init: RequestInit,
): Promise<AssetsApiResult<unknown>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: e instanceof Error ? e.message : "Сбой сети при обращении к API.",
      },
    };
  }
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${res.status}`;
    return {
      ok: false,
      error: { kind: "http", status: res.status, message },
    };
  }
  return { ok: true, value: body };
}

export async function listVisitAssets(
  args: ListVisitAssetsArgs,
): Promise<AssetsApiResult<SafeAssetDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return { ok: false, error: cfg };
  if (!args.visitId) {
    return { ok: false, error: { kind: "validation", message: "visitId обязателен." } };
  }
  const url = buildApiReadUrl(args.baseUrl as string, `/doctor/visits/${args.visitId}/assets`);
  const r = await request(url, { method: "GET", headers: authHeaders(args.token as string) });
  if (!r.ok) return r;
  const arr = Array.isArray(r.value)
    ? r.value
    : r.value && typeof r.value === "object" && Array.isArray((r.value as { items?: unknown[] }).items)
      ? ((r.value as { items: unknown[] }).items as unknown[])
      : [];
  const items = arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map(toSafeAssetDTO);
  return { ok: true, value: items };
}

export async function uploadVisitAsset(
  args: UploadVisitAssetArgs,
): Promise<AssetsApiResult<SafeAssetDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return { ok: false, error: cfg };
  if (!args.visitId || !args.file) {
    return { ok: false, error: { kind: "validation", message: "visitId и file обязательны." } };
  }
  const form = new FormData();
  form.append("file", args.file);
  form.append("kind", args.kind);
  form.append("source", args.source);
  if (args.lesionId) form.append("lesionId", args.lesionId);
  if (args.capturedAt) form.append("capturedAt", args.capturedAt);
  if (args.deviceId) form.append("deviceId", args.deviceId);

  const url = buildApiWriteUrl(args.baseUrl as string, `/doctor/visits/${args.visitId}/assets/upload`);
  const r = await request(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token as string}` },
    body: form,
  });
  if (!r.ok) return r;
  const obj = (r.value && typeof r.value === "object" ? (r.value as Record<string, unknown>) : {});
  return { ok: true, value: toSafeAssetDTO(obj) };
}

export async function getAssetDownloadUrl(
  args: GetAssetDownloadUrlArgs,
): Promise<AssetsApiResult<SignedDownloadDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return { ok: false, error: cfg };
  if (!args.assetId) {
    return { ok: false, error: { kind: "validation", message: "assetId обязателен." } };
  }
  const qs = args.expiresIn ? `?expiresIn=${encodeURIComponent(String(args.expiresIn))}` : "";
  const url = buildApiReadUrl(
    args.baseUrl as string,
    `/doctor/assets/${args.assetId}/download-url${qs}`,
  );
  const r = await request(url, { method: "GET", headers: authHeaders(args.token as string) });
  if (!r.ok) return r;
  const obj = (r.value && typeof r.value === "object" ? (r.value as Record<string, unknown>) : {});
  return { ok: true, value: toSignedDownloadDTO(obj) };
}
