// Stage 4Q · Self-hosted Device Bridge registry client.
// Browser reads device metadata only through our backend. No direct hardware APIs.

import {
  buildSelfHostedApiUrl,
  type SelfHostedApiError,
  type SelfHostedApiResult,
} from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface SelfHostedDeviceBridgeDTO {
  id: string;
  bridgeCode: string;
  hostName: string;
  lanStatus: "online" | "degraded" | "offline";
  version: string;
  pairedCount: number;
  lastHeartbeatAt: string | null;
  clinic?: {
    id?: string;
    slug?: string;
    name?: string;
  };
}

export interface SelfHostedDeviceDTO {
  id: string;
  model: string;
  serial: string;
  firmware: string;
  magnification: string;
  polarization: "polarized" | "non_polarized" | "both";
  calibrationProfile: string;
  calibrationDueAt: string | null;
  status: "connected" | "standby" | "offline";
  lastSeenAt: string | null;
  bridgeId: string | null;
  bridge?: {
    id?: string;
    code?: string;
    hostName?: string;
    lanStatus?: "online" | "degraded" | "offline";
  } | null;
  clinic?: {
    id?: string;
    slug?: string;
    name?: string;
  };
}

export interface ListSelfHostedDevicesArgs extends BaseArgs {
  search?: string;
  status?: "all" | "connected" | "standby" | "offline";
  needsCalibration?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListSelfHostedDeviceBridgesArgs extends BaseArgs {
  bridgeStatus?: "all" | "online" | "degraded" | "offline";
}

export type SelfHostedDeviceCommandType =
  | "bridge_health_check"
  | "device_calibration_request"
  | "device_stream_open_request";

export interface SelfHostedDeviceCommandDTO {
  id: string;
  clinicId: string;
  bridgeId: string | null;
  deviceId: string | null;
  commandType: SelfHostedDeviceCommandType;
  status: "queued" | "acknowledged" | "completed" | "failed" | "cancelled";
  reason: string | null;
  createdAt: string | null;
}

export interface RequestSelfHostedBridgeCommandArgs extends BaseArgs {
  bridgeId: string;
  commandType: "bridge_health_check";
  reason?: string;
}

export interface RequestSelfHostedDeviceCommandArgs extends BaseArgs {
  deviceId: string;
  commandType: "device_calibration_request" | "device_stream_open_request";
  reason?: string;
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

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
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

async function requestJson(url: string, token: string): Promise<SelfHostedApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: authHeaders(token),
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
  return ok(body);
}

async function postJson(url: string, token: string, body: unknown): Promise<SelfHostedApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  const parsed = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, parsed));
  return ok(parsed);
}

function normalizeLanStatus(input: unknown): SelfHostedDeviceBridgeDTO["lanStatus"] {
  if (input === "online" || input === "degraded" || input === "offline") return input;
  return "offline";
}

function normalizeDeviceStatus(input: unknown): SelfHostedDeviceDTO["status"] {
  if (input === "connected" || input === "standby" || input === "offline") return input;
  return "offline";
}

function normalizePolarization(input: unknown): SelfHostedDeviceDTO["polarization"] {
  if (input === "polarized" || input === "non_polarized" || input === "both") return input;
  return "polarized";
}

function toClinic(input: unknown): SelfHostedDeviceDTO["clinic"] {
  return isRecord(input)
    ? {
        id: input.id ? String(input.id) : undefined,
        slug: input.slug ? String(input.slug) : undefined,
        name: input.name ? String(input.name) : undefined,
      }
    : undefined;
}

export function toSelfHostedDeviceBridgeDTO(input: unknown): SelfHostedDeviceBridgeDTO | null {
  if (!isRecord(input)) return null;
  const id = String(input.id ?? "");
  const bridgeCode = String(input.bridgeCode ?? "");
  if (!id || !bridgeCode) return null;
  return {
    id,
    bridgeCode,
    hostName: String(input.hostName ?? ""),
    lanStatus: normalizeLanStatus(input.lanStatus),
    version: String(input.version ?? ""),
    pairedCount: Number(input.pairedCount ?? 0),
    lastHeartbeatAt: input.lastHeartbeatAt ? String(input.lastHeartbeatAt) : null,
    clinic: toClinic(input.clinic),
  };
}

export function toSelfHostedDeviceDTO(input: unknown): SelfHostedDeviceDTO | null {
  if (!isRecord(input)) return null;
  const id = String(input.id ?? "");
  const serial = String(input.serial ?? "");
  if (!id || !serial) return null;
  const bridge = isRecord(input.bridge)
    ? {
        id: input.bridge.id ? String(input.bridge.id) : undefined,
        code: input.bridge.code ? String(input.bridge.code) : undefined,
        hostName: input.bridge.hostName ? String(input.bridge.hostName) : undefined,
        lanStatus: normalizeLanStatus(input.bridge.lanStatus),
      }
    : null;
  return {
    id,
    model: String(input.model ?? ""),
    serial,
    firmware: String(input.firmware ?? ""),
    magnification: String(input.magnification ?? ""),
    polarization: normalizePolarization(input.polarization),
    calibrationProfile: String(input.calibrationProfile ?? ""),
    calibrationDueAt: input.calibrationDueAt ? String(input.calibrationDueAt).slice(0, 10) : null,
    status: normalizeDeviceStatus(input.status),
    lastSeenAt: input.lastSeenAt ? String(input.lastSeenAt) : null,
    bridgeId: input.bridgeId ? String(input.bridgeId) : null,
    bridge,
    clinic: toClinic(input.clinic),
  };
}

function normalizeCommandType(input: unknown): SelfHostedDeviceCommandType | null {
  if (
    input === "bridge_health_check" ||
    input === "device_calibration_request" ||
    input === "device_stream_open_request"
  ) {
    return input;
  }
  return null;
}

function normalizeCommandStatus(input: unknown): SelfHostedDeviceCommandDTO["status"] {
  if (
    input === "queued" ||
    input === "acknowledged" ||
    input === "completed" ||
    input === "failed" ||
    input === "cancelled"
  ) {
    return input;
  }
  return "queued";
}

export function toSelfHostedDeviceCommandDTO(input: unknown): SelfHostedDeviceCommandDTO | null {
  if (!isRecord(input)) return null;
  const id = String(input.id ?? "");
  const commandType = normalizeCommandType(input.commandType);
  if (!id || !commandType) return null;
  return {
    id,
    clinicId: String(input.clinicId ?? ""),
    bridgeId: input.bridgeId ? String(input.bridgeId) : null,
    deviceId: input.deviceId ? String(input.deviceId) : null,
    commandType,
    status: normalizeCommandStatus(input.status),
    reason: input.reason ? String(input.reason) : null,
    createdAt: input.createdAt ? String(input.createdAt) : null,
  };
}

function extractItems<T>(body: unknown, mapper: (item: unknown) => T | null): T[] {
  const rawItems = isRecord(body) && Array.isArray(body.items) ? body.items : [];
  return rawItems.map(mapper).filter((item): item is T => item != null);
}

export async function listSelfHostedDeviceBridges(
  args: ListSelfHostedDeviceBridgesArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  if (args.bridgeStatus && args.bridgeStatus !== "all") params.set("bridgeStatus", args.bridgeStatus);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridges${suffix}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  return ok(extractItems(result.value, toSelfHostedDeviceBridgeDTO));
}

export async function listSelfHostedDevices(
  args: ListSelfHostedDevicesArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 200));
  params.set("offset", String(args.offset ?? 0));
  if (args.search?.trim()) params.set("search", args.search.trim());
  if (args.status && args.status !== "all") params.set("status", args.status);
  if (args.needsCalibration) params.set("needsCalibration", "true");
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/devices?${params.toString()}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  return ok(extractItems(result.value, toSelfHostedDeviceDTO));
}

function extractCommand(body: unknown): SelfHostedDeviceCommandDTO | null {
  return isRecord(body) ? toSelfHostedDeviceCommandDTO(body.command) : null;
}

export async function requestSelfHostedBridgeCommand(
  args: RequestSelfHostedBridgeCommandArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceCommandDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.bridgeId) {
    return fail({
      kind: "validation",
      code: "bridge_id_required",
      message: "Не выбран Device Bridge.",
    });
  }
  const result = await postJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridges/${encodeURIComponent(args.bridgeId)}/commands`),
    args.apiToken as string,
    { commandType: args.commandType, reason: args.reason },
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const command = extractCommand(result.value);
  return command
    ? ok(command)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ команды.",
      });
}

export async function requestSelfHostedDeviceCommand(
  args: RequestSelfHostedDeviceCommandArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceCommandDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.deviceId) {
    return fail({
      kind: "validation",
      code: "device_id_required",
      message: "Не выбрано устройство.",
    });
  }
  const result = await postJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/devices/${encodeURIComponent(args.deviceId)}/commands`),
    args.apiToken as string,
    { commandType: args.commandType, reason: args.reason },
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const command = extractCommand(result.value);
  return command
    ? ok(command)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ команды.",
      });
}
