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

export type SelfHostedWorkerStatusFilter = "all" | "unknown" | "online" | "degraded" | "offline";
export type SelfHostedCommandStatusFilter =
  | "all"
  | "queued"
  | "acknowledged"
  | "completed"
  | "failed"
  | "cancelled";

export interface SelfHostedDeviceBridgeWorkerBridgeDTO {
  id: string;
  clinicId: string;
  bridgeCode: string;
  hostName: string;
  lanStatus: "online" | "degraded" | "offline";
  workerStatus: "unknown" | "online" | "degraded" | "offline";
  version: string;
  workerVersion: string;
  lastHeartbeatAt: string | null;
  workerLastSeenAt: string | null;
  pairedCount: number;
  queuedCount: number;
  acknowledgedCount: number;
  completedCount: number;
  failedCount: number;
  latestCommandAt: string | null;
  clinic?: {
    id?: string;
    slug?: string;
    name?: string;
  };
}

export interface SelfHostedDeviceBridgeWorkerCommandDTO {
  id: string;
  clinicId: string;
  bridgeId: string | null;
  deviceId: string | null;
  bridgeCode: string | null;
  deviceSerial: string | null;
  commandType: SelfHostedDeviceCommandType;
  status: "queued" | "acknowledged" | "completed" | "failed" | "cancelled";
  reason: string | null;
  createdAt: string | null;
  dispatchedAt: string | null;
  acknowledgedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedDeviceBridgeWorkerSummaryDTO {
  bridgeCount: number;
  onlineWorkers: number;
  degradedWorkers: number;
  offlineWorkers: number;
  queuedCommands: number;
  failedCommands: number;
}

export interface SelfHostedDeviceBridgeWorkerHardeningSummaryDTO {
  staleWorkers: number;
  retryingCommands: number;
  rateLimitedCommands: number;
  maxQueueAgeSeconds: number;
  cleanupCandidates: number;
}

export interface SelfHostedDeviceBridgeWorkerHardeningBridgeDTO {
  id: string;
  clinicId: string;
  bridgeCode: string;
  hostName: string;
  workerStatus: "unknown" | "online" | "degraded" | "offline";
  workerVersion: string;
  workerLastSeenAt: string | null;
  stale: boolean;
  activeCommandCount: number;
  retryingCommandCount: number;
  rateLimitedCommandCount: number;
  maxQueueAgeSeconds: number;
}

export interface SelfHostedDeviceBridgeWorkerHardeningDTO {
  stage: "4V" | string;
  source: "postgres" | string;
  summary: SelfHostedDeviceBridgeWorkerHardeningSummaryDTO;
  policy: {
    staleAfterMinutes: number;
    retentionDays: number;
    pollBackoff: string;
    maxPollLimit: number;
  };
  items: SelfHostedDeviceBridgeWorkerHardeningBridgeDTO[];
  count: number;
  filters: {
    limit: number;
    staleAfterMinutes: number;
    retentionDays: number;
  };
  correlationId: string;
  generatedAt: string;
}

export interface SelfHostedDeviceBridgeWorkerRecoverySummaryDTO {
  stuckCommands: number;
  expiredCommands: number;
  leaseExpiredCommands: number;
  retryableCommands: number;
  cancellableCommands: number;
}

export interface SelfHostedDeviceBridgeWorkerRecoveryCommandDTO extends SelfHostedDeviceBridgeWorkerCommandDTO {
  attemptCount: number;
  lifecycleRevision: number;
  lastPolledAt: string | null;
  nextAttemptAt: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  expiresAt: string | null;
  recoveryAction: string | null;
  recoveryReason: string | null;
  recoveryRequestedAt: string | null;
  recoveryState: string | null;
  replayOfCommandId: string | null;
  replayRequestedAt: string | null;
  replayPolicy: string | null;
}

export interface SelfHostedDeviceBridgeWorkerRecoveryDTO {
  stage: "4W" | string;
  source: "postgres" | string;
  summary: SelfHostedDeviceBridgeWorkerRecoverySummaryDTO;
  policy: {
    staleAfterMinutes: number;
    leaseTtlSeconds: number;
    maxRecoveryBatch: number;
    allowedActions: string[];
  };
  items: SelfHostedDeviceBridgeWorkerRecoveryCommandDTO[];
  count: number;
  filters: {
    limit: number;
    staleAfterMinutes: number;
    leaseTtlSeconds: number;
  };
  correlationId: string;
  generatedAt: string;
}

export type SelfHostedDeviceBridgeCommandAuditAction =
  | "all"
  | "poll"
  | "ack"
  | "complete"
  | "reschedule"
  | "cancel"
  | "replay";

export interface SelfHostedDeviceBridgeCommandAuditSummaryDTO {
  totalEvents: number;
  replayEvents: number;
  recoveryEvents: number;
  affectedCommands: number;
}

export interface SelfHostedDeviceBridgeCommandAuditEventDTO {
  id: string;
  clinicId: string;
  actorUserId: string | null;
  action: SelfHostedDeviceBridgeCommandAuditAction;
  commandId: string | null;
  correlationId: string | null;
  createdAt: string | null;
  bridgeId: string | null;
  deviceId: string | null;
  bridgeCode: string | null;
  deviceSerial: string | null;
  commandType: SelfHostedDeviceCommandType | null;
  status: SelfHostedDeviceCommandDTO["status"];
  reason: string | null;
  attemptCount: number;
  lifecycleRevision: number;
  replayOfCommandId: string | null;
  replayRequestedAt: string | null;
  replayPolicy: string | null;
}

export interface SelfHostedDeviceBridgeCommandAuditDTO {
  stage: "4X" | string;
  source: "postgres" | string;
  summary: SelfHostedDeviceBridgeCommandAuditSummaryDTO;
  policy: {
    replayPolicy: string;
    allowedReplayStatuses: string[];
    allowedReplayCommandTypes: string[];
    payloadVisibility: string;
  };
  items: SelfHostedDeviceBridgeCommandAuditEventDTO[];
  count: number;
  filters: {
    action: SelfHostedDeviceBridgeCommandAuditAction;
    status: SelfHostedCommandStatusFilter;
    limit: number;
  };
  correlationId: string;
  generatedAt: string;
}

export interface SelfHostedDeviceBridgeCommandAuditExportDTO {
  stage: "4Y" | string;
  source: "postgres" | string;
  export: {
    format: "csv";
    mime: string;
    filename: string;
    rowCount: number;
    content: string;
    privacy: {
      payloadVisibility: string;
      excludedFieldCount: number;
      exportedFieldSet: string;
    };
  };
  filters: {
    action: SelfHostedDeviceBridgeCommandAuditAction;
    status: SelfHostedCommandStatusFilter;
    limit: number;
  };
  correlationId: string;
  generatedAt: string;
}

export interface SelfHostedDeviceBridgeWorkerStatusDTO {
  stage: "4U" | string;
  source: "postgres" | string;
  summary: SelfHostedDeviceBridgeWorkerSummaryDTO;
  items: SelfHostedDeviceBridgeWorkerBridgeDTO[];
  commands: SelfHostedDeviceBridgeWorkerCommandDTO[];
  count: number;
  commandCount: number;
  filters: {
    workerStatus: SelfHostedWorkerStatusFilter;
    commandStatus: SelfHostedCommandStatusFilter;
    limit: number;
  };
  correlationId: string;
  generatedAt: string;
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

export interface GetSelfHostedDeviceBridgeWorkerStatusArgs extends BaseArgs {
  workerStatus?: SelfHostedWorkerStatusFilter;
  commandStatus?: SelfHostedCommandStatusFilter;
  limit?: number;
}

export interface GetSelfHostedDeviceBridgeWorkerHardeningArgs extends BaseArgs {
  staleAfterMinutes?: number;
  retentionDays?: number;
  limit?: number;
}

export interface GetSelfHostedDeviceBridgeWorkerRecoveryArgs extends BaseArgs {
  staleAfterMinutes?: number;
  leaseTtlSeconds?: number;
  limit?: number;
}

export interface RecoverSelfHostedDeviceBridgeWorkerCommandArgs extends BaseArgs {
  commandId: string;
  action: "reschedule" | "cancel";
  reason?: string;
}

export interface GetSelfHostedDeviceBridgeCommandAuditArgs extends BaseArgs {
  action?: SelfHostedDeviceBridgeCommandAuditAction;
  status?: SelfHostedCommandStatusFilter;
  limit?: number;
}

export interface ReplaySelfHostedDeviceBridgeCommandArgs extends BaseArgs {
  commandId: string;
  reason?: string;
}

export interface ExportSelfHostedDeviceBridgeCommandAuditArgs extends GetSelfHostedDeviceBridgeCommandAuditArgs {}

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

function normalizeWorkerStatus(input: unknown): SelfHostedDeviceBridgeWorkerBridgeDTO["workerStatus"] {
  if (input === "online" || input === "degraded" || input === "offline" || input === "unknown") {
    return input;
  }
  return "unknown";
}

function normalizeWorkerStatusFilter(input: unknown): SelfHostedWorkerStatusFilter {
  if (input === "all" || input === "online" || input === "degraded" || input === "offline" || input === "unknown") {
    return input;
  }
  return "all";
}

function normalizeCommandStatusFilter(input: unknown): SelfHostedCommandStatusFilter {
  if (input === "all") return "all";
  if (
    input === "queued" ||
    input === "acknowledged" ||
    input === "completed" ||
    input === "failed" ||
    input === "cancelled"
  ) {
    return input;
  }
  return "all";
}

function normalizeCommandAuditAction(input: unknown): SelfHostedDeviceBridgeCommandAuditAction {
  if (
    input === "poll" ||
    input === "ack" ||
    input === "complete" ||
    input === "reschedule" ||
    input === "cancel" ||
    input === "replay"
  ) {
    return input;
  }
  return "all";
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

export function toSelfHostedDeviceBridgeWorkerBridgeDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerBridgeDTO | null {
  if (!isRecord(input)) return null;
  const id = String(input.id ?? "");
  const bridgeCode = String(input.bridgeCode ?? "");
  if (!id || !bridgeCode) return null;
  return {
    id,
    clinicId: String(input.clinicId ?? ""),
    bridgeCode,
    hostName: String(input.hostName ?? ""),
    lanStatus: normalizeLanStatus(input.lanStatus),
    workerStatus: normalizeWorkerStatus(input.workerStatus),
    version: String(input.version ?? ""),
    workerVersion: String(input.workerVersion ?? input.version ?? ""),
    lastHeartbeatAt: input.lastHeartbeatAt ? String(input.lastHeartbeatAt) : null,
    workerLastSeenAt: input.workerLastSeenAt ? String(input.workerLastSeenAt) : null,
    pairedCount: Number(input.pairedCount ?? 0),
    queuedCount: Number(input.queuedCount ?? 0),
    acknowledgedCount: Number(input.acknowledgedCount ?? 0),
    completedCount: Number(input.completedCount ?? 0),
    failedCount: Number(input.failedCount ?? 0),
    latestCommandAt: input.latestCommandAt ? String(input.latestCommandAt) : null,
    clinic: toClinic(input.clinic),
  };
}

export function toSelfHostedDeviceBridgeWorkerCommandDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerCommandDTO | null {
  const command = toSelfHostedDeviceCommandDTO(input);
  if (!command || !isRecord(input)) return null;
  return {
    ...command,
    bridgeCode: input.bridgeCode ? String(input.bridgeCode) : null,
    deviceSerial: input.deviceSerial ? String(input.deviceSerial) : null,
    dispatchedAt: input.dispatchedAt ? String(input.dispatchedAt) : null,
    acknowledgedAt: input.acknowledgedAt ? String(input.acknowledgedAt) : null,
    completedAt: input.completedAt ? String(input.completedAt) : null,
    updatedAt: input.updatedAt ? String(input.updatedAt) : null,
  };
}

export function toSelfHostedDeviceBridgeWorkerStatusDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerStatusDTO | null {
  if (!isRecord(input)) return null;
  const summary = isRecord(input.summary) ? input.summary : {};
  const filters = isRecord(input.filters) ? input.filters : {};
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "postgres",
    summary: {
      bridgeCount: Number(summary.bridgeCount ?? 0),
      onlineWorkers: Number(summary.onlineWorkers ?? 0),
      degradedWorkers: Number(summary.degradedWorkers ?? 0),
      offlineWorkers: Number(summary.offlineWorkers ?? 0),
      queuedCommands: Number(summary.queuedCommands ?? 0),
      failedCommands: Number(summary.failedCommands ?? 0),
    },
    items: Array.isArray(input.items)
      ? input.items
          .map(toSelfHostedDeviceBridgeWorkerBridgeDTO)
          .filter((item): item is SelfHostedDeviceBridgeWorkerBridgeDTO => item != null)
      : [],
    commands: Array.isArray(input.commands)
      ? input.commands
          .map(toSelfHostedDeviceBridgeWorkerCommandDTO)
          .filter((item): item is SelfHostedDeviceBridgeWorkerCommandDTO => item != null)
      : [],
    count: Number(input.count ?? 0),
    commandCount: Number(input.commandCount ?? 0),
    filters: {
      workerStatus: normalizeWorkerStatusFilter(filters.workerStatus),
      commandStatus: normalizeCommandStatusFilter(filters.commandStatus),
      limit: Number(filters.limit ?? 25),
    },
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
  };
}

export function toSelfHostedDeviceBridgeWorkerHardeningBridgeDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerHardeningBridgeDTO | null {
  if (!isRecord(input)) return null;
  const id = String(input.id ?? "");
  const bridgeCode = String(input.bridgeCode ?? "");
  if (!id || !bridgeCode) return null;
  return {
    id,
    clinicId: String(input.clinicId ?? ""),
    bridgeCode,
    hostName: String(input.hostName ?? ""),
    workerStatus: normalizeWorkerStatus(input.workerStatus),
    workerVersion: String(input.workerVersion ?? ""),
    workerLastSeenAt: input.workerLastSeenAt ? String(input.workerLastSeenAt) : null,
    stale: Boolean(input.stale),
    activeCommandCount: Number(input.activeCommandCount ?? 0),
    retryingCommandCount: Number(input.retryingCommandCount ?? 0),
    rateLimitedCommandCount: Number(input.rateLimitedCommandCount ?? 0),
    maxQueueAgeSeconds: Number(input.maxQueueAgeSeconds ?? 0),
  };
}

export function toSelfHostedDeviceBridgeWorkerHardeningDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerHardeningDTO | null {
  if (!isRecord(input)) return null;
  const summary = isRecord(input.summary) ? input.summary : {};
  const policy = isRecord(input.policy) ? input.policy : {};
  const filters = isRecord(input.filters) ? input.filters : {};
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "postgres",
    summary: {
      staleWorkers: Number(summary.staleWorkers ?? 0),
      retryingCommands: Number(summary.retryingCommands ?? 0),
      rateLimitedCommands: Number(summary.rateLimitedCommands ?? 0),
      maxQueueAgeSeconds: Number(summary.maxQueueAgeSeconds ?? 0),
      cleanupCandidates: Number(summary.cleanupCandidates ?? 0),
    },
    policy: {
      staleAfterMinutes: Number(policy.staleAfterMinutes ?? 10),
      retentionDays: Number(policy.retentionDays ?? 30),
      pollBackoff: typeof policy.pollBackoff === "string" ? policy.pollBackoff : "linear-capped",
      maxPollLimit: Number(policy.maxPollLimit ?? 50),
    },
    items: Array.isArray(input.items)
      ? input.items
          .map(toSelfHostedDeviceBridgeWorkerHardeningBridgeDTO)
          .filter((item): item is SelfHostedDeviceBridgeWorkerHardeningBridgeDTO => item != null)
      : [],
    count: Number(input.count ?? 0),
    filters: {
      limit: Number(filters.limit ?? 25),
      staleAfterMinutes: Number(filters.staleAfterMinutes ?? 10),
      retentionDays: Number(filters.retentionDays ?? 30),
    },
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
  };
}

export function toSelfHostedDeviceBridgeWorkerRecoveryCommandDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerRecoveryCommandDTO | null {
  const command = toSelfHostedDeviceBridgeWorkerCommandDTO(input);
  if (!command || !isRecord(input)) return null;
  return {
    ...command,
    attemptCount: Number(input.attemptCount ?? 0),
    lifecycleRevision: Number(input.lifecycleRevision ?? 0),
    lastPolledAt: input.lastPolledAt ? String(input.lastPolledAt) : null,
    nextAttemptAt: input.nextAttemptAt ? String(input.nextAttemptAt) : null,
    leaseOwner: input.leaseOwner ? String(input.leaseOwner) : null,
    leaseExpiresAt: input.leaseExpiresAt ? String(input.leaseExpiresAt) : null,
    expiresAt: input.expiresAt ? String(input.expiresAt) : null,
    recoveryAction: input.recoveryAction ? String(input.recoveryAction) : null,
    recoveryReason: input.recoveryReason ? String(input.recoveryReason) : null,
    recoveryRequestedAt: input.recoveryRequestedAt ? String(input.recoveryRequestedAt) : null,
    recoveryState: input.recoveryState ? String(input.recoveryState) : null,
    replayOfCommandId: input.replayOfCommandId ? String(input.replayOfCommandId) : null,
    replayRequestedAt: input.replayRequestedAt ? String(input.replayRequestedAt) : null,
    replayPolicy: input.replayPolicy ? String(input.replayPolicy) : null,
  };
}

export function toSelfHostedDeviceBridgeCommandAuditEventDTO(
  input: unknown,
): SelfHostedDeviceBridgeCommandAuditEventDTO | null {
  if (!isRecord(input)) return null;
  const id = String(input.id ?? "");
  if (!id) return null;
  return {
    id,
    clinicId: String(input.clinicId ?? ""),
    actorUserId: input.actorUserId ? String(input.actorUserId) : null,
    action: normalizeCommandAuditAction(input.action),
    commandId: input.commandId ? String(input.commandId) : null,
    correlationId: input.correlationId ? String(input.correlationId) : null,
    createdAt: input.createdAt ? String(input.createdAt) : null,
    bridgeId: input.bridgeId ? String(input.bridgeId) : null,
    deviceId: input.deviceId ? String(input.deviceId) : null,
    bridgeCode: input.bridgeCode ? String(input.bridgeCode) : null,
    deviceSerial: input.deviceSerial ? String(input.deviceSerial) : null,
    commandType: normalizeCommandType(input.commandType),
    status: normalizeCommandStatus(input.status),
    reason: input.reason ? String(input.reason) : null,
    attemptCount: Number(input.attemptCount ?? 0),
    lifecycleRevision: Number(input.lifecycleRevision ?? 0),
    replayOfCommandId: input.replayOfCommandId ? String(input.replayOfCommandId) : null,
    replayRequestedAt: input.replayRequestedAt ? String(input.replayRequestedAt) : null,
    replayPolicy: input.replayPolicy ? String(input.replayPolicy) : null,
  };
}

export function toSelfHostedDeviceBridgeWorkerRecoveryDTO(
  input: unknown,
): SelfHostedDeviceBridgeWorkerRecoveryDTO | null {
  if (!isRecord(input)) return null;
  const summary = isRecord(input.summary) ? input.summary : {};
  const policy = isRecord(input.policy) ? input.policy : {};
  const filters = isRecord(input.filters) ? input.filters : {};
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "postgres",
    summary: {
      stuckCommands: Number(summary.stuckCommands ?? 0),
      expiredCommands: Number(summary.expiredCommands ?? 0),
      leaseExpiredCommands: Number(summary.leaseExpiredCommands ?? 0),
      retryableCommands: Number(summary.retryableCommands ?? 0),
      cancellableCommands: Number(summary.cancellableCommands ?? 0),
    },
    policy: {
      staleAfterMinutes: Number(policy.staleAfterMinutes ?? 10),
      leaseTtlSeconds: Number(policy.leaseTtlSeconds ?? 90),
      maxRecoveryBatch: Number(policy.maxRecoveryBatch ?? 100),
      allowedActions: Array.isArray(policy.allowedActions) ? policy.allowedActions.map(String) : ["reschedule", "cancel"],
    },
    items: Array.isArray(input.items)
      ? input.items
          .map(toSelfHostedDeviceBridgeWorkerRecoveryCommandDTO)
          .filter((item): item is SelfHostedDeviceBridgeWorkerRecoveryCommandDTO => item != null)
      : [],
    count: Number(input.count ?? 0),
    filters: {
      limit: Number(filters.limit ?? 25),
      staleAfterMinutes: Number(filters.staleAfterMinutes ?? 10),
      leaseTtlSeconds: Number(filters.leaseTtlSeconds ?? 90),
    },
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
  };
}

export function toSelfHostedDeviceBridgeCommandAuditDTO(
  input: unknown,
): SelfHostedDeviceBridgeCommandAuditDTO | null {
  if (!isRecord(input)) return null;
  const summary = isRecord(input.summary) ? input.summary : {};
  const policy = isRecord(input.policy) ? input.policy : {};
  const filters = isRecord(input.filters) ? input.filters : {};
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "postgres",
    summary: {
      totalEvents: Number(summary.totalEvents ?? 0),
      replayEvents: Number(summary.replayEvents ?? 0),
      recoveryEvents: Number(summary.recoveryEvents ?? 0),
      affectedCommands: Number(summary.affectedCommands ?? 0),
    },
    policy: {
      replayPolicy: typeof policy.replayPolicy === "string" ? policy.replayPolicy : "manual_system_admin",
      allowedReplayStatuses: Array.isArray(policy.allowedReplayStatuses)
        ? policy.allowedReplayStatuses.map(String)
        : ["completed", "failed", "cancelled"],
      allowedReplayCommandTypes: Array.isArray(policy.allowedReplayCommandTypes)
        ? policy.allowedReplayCommandTypes.map(String)
        : ["bridge_health_check", "device_calibration_request"],
      payloadVisibility: typeof policy.payloadVisibility === "string" ? policy.payloadVisibility : "backend-only",
    },
    items: Array.isArray(input.items)
      ? input.items
          .map(toSelfHostedDeviceBridgeCommandAuditEventDTO)
          .filter((item): item is SelfHostedDeviceBridgeCommandAuditEventDTO => item != null)
      : [],
    count: Number(input.count ?? 0),
    filters: {
      action: normalizeCommandAuditAction(filters.action),
      status: normalizeCommandStatusFilter(filters.status),
      limit: Number(filters.limit ?? 25),
    },
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
  };
}

export function toSelfHostedDeviceBridgeCommandAuditExportDTO(
  input: unknown,
): SelfHostedDeviceBridgeCommandAuditExportDTO | null {
  if (!isRecord(input) || !isRecord(input.export)) return null;
  const file = input.export;
  const filters = isRecord(input.filters) ? input.filters : {};
  const privacy = isRecord(file.privacy) ? file.privacy : {};
  const filename = typeof file.filename === "string" ? file.filename : "";
  const content = typeof file.content === "string" ? file.content : "";
  if (!filename || !content) return null;
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "postgres",
    export: {
      format: "csv",
      mime: typeof file.mime === "string" ? file.mime : "text/csv;charset=utf-8",
      filename,
      rowCount: Number(file.rowCount ?? 0),
      content,
      privacy: {
        payloadVisibility: typeof privacy.payloadVisibility === "string"
          ? privacy.payloadVisibility
          : "backend-only",
        excludedFieldCount: Number(privacy.excludedFieldCount ?? 0),
        exportedFieldSet: typeof privacy.exportedFieldSet === "string"
          ? privacy.exportedFieldSet
          : "safe-command-metadata-only",
      },
    },
    filters: {
      action: normalizeCommandAuditAction(filters.action),
      status: normalizeCommandStatusFilter(filters.status),
      limit: Number(filters.limit ?? 25),
    },
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
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

export async function getSelfHostedDeviceBridgeWorkerStatus(
  args: GetSelfHostedDeviceBridgeWorkerStatusArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeWorkerStatusDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 25));
  if (args.workerStatus && args.workerStatus !== "all") params.set("workerStatus", args.workerStatus);
  if (args.commandStatus && args.commandStatus !== "all") params.set("commandStatus", args.commandStatus);
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridge-worker/status?${params.toString()}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const status = toSelfHostedDeviceBridgeWorkerStatusDTO(result.value);
  return status
    ? ok(status)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ статуса Device Bridge worker.",
      });
}

export async function getSelfHostedDeviceBridgeWorkerHardening(
  args: GetSelfHostedDeviceBridgeWorkerHardeningArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeWorkerHardeningDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 25));
  params.set("staleAfterMinutes", String(args.staleAfterMinutes ?? 10));
  params.set("retentionDays", String(args.retentionDays ?? 30));
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridge-worker/hardening?${params.toString()}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const hardening = toSelfHostedDeviceBridgeWorkerHardeningDTO(result.value);
  return hardening
    ? ok(hardening)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ hardening Device Bridge worker.",
      });
}

export async function getSelfHostedDeviceBridgeWorkerRecovery(
  args: GetSelfHostedDeviceBridgeWorkerRecoveryArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeWorkerRecoveryDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 25));
  params.set("staleAfterMinutes", String(args.staleAfterMinutes ?? 10));
  params.set("leaseTtlSeconds", String(args.leaseTtlSeconds ?? 90));
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridge-worker/recovery?${params.toString()}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const recovery = toSelfHostedDeviceBridgeWorkerRecoveryDTO(result.value);
  return recovery
    ? ok(recovery)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ recovery Device Bridge worker.",
      });
}

export async function recoverSelfHostedDeviceBridgeWorkerCommand(
  args: RecoverSelfHostedDeviceBridgeWorkerCommandArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeWorkerRecoveryCommandDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.commandId) {
    return fail({
      kind: "validation",
      code: "command_id_required",
      message: "Не выбрана команда Device Bridge worker.",
    });
  }
  const result = await postJson(
    buildSelfHostedApiUrl(
      args.apiBaseUrl,
      `/api/v1/device-bridge-worker/commands/${encodeURIComponent(args.commandId)}/recovery`,
    ),
    args.apiToken as string,
    { action: args.action, reason: args.reason },
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const command = isRecord(result.value)
    ? toSelfHostedDeviceBridgeWorkerRecoveryCommandDTO(result.value.command)
    : null;
  return command
    ? ok(command)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ восстановления команды Device Bridge worker.",
      });
}

export async function getSelfHostedDeviceBridgeCommandAudit(
  args: GetSelfHostedDeviceBridgeCommandAuditArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeCommandAuditDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 25));
  if (args.action && args.action !== "all") params.set("action", args.action);
  if (args.status && args.status !== "all") params.set("status", args.status);
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridge-worker/audit?${params.toString()}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const audit = toSelfHostedDeviceBridgeCommandAuditDTO(result.value);
  return audit
    ? ok(audit)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ аудита команд Device Bridge.",
      });
}

export async function exportSelfHostedDeviceBridgeCommandAudit(
  args: ExportSelfHostedDeviceBridgeCommandAuditArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeCommandAuditExportDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 25));
  if (args.action && args.action !== "all") params.set("action", args.action);
  if (args.status && args.status !== "all") params.set("status", args.status);
  const result = await requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/device-bridge-worker/audit/export?${params.toString()}`),
    args.apiToken as string,
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const exportFile = toSelfHostedDeviceBridgeCommandAuditExportDTO(result.value);
  return exportFile
    ? ok(exportFile)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ экспорта аудита команд Device Bridge.",
      });
}

export async function replaySelfHostedDeviceBridgeCommand(
  args: ReplaySelfHostedDeviceBridgeCommandArgs,
): Promise<SelfHostedApiResult<SelfHostedDeviceBridgeWorkerRecoveryCommandDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.commandId) {
    return fail({
      kind: "validation",
      code: "command_id_required",
      message: "Не выбрана команда Device Bridge для replay.",
    });
  }
  const result = await postJson(
    buildSelfHostedApiUrl(
      args.apiBaseUrl,
      `/api/v1/device-bridge-worker/commands/${encodeURIComponent(args.commandId)}/replay`,
    ),
    args.apiToken as string,
    { reason: args.reason },
  );
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const command = isRecord(result.value)
    ? toSelfHostedDeviceBridgeWorkerRecoveryCommandDTO(result.value.command)
    : null;
  return command
    ? ok(command)
    : fail({
        kind: "http",
        code: "invalid_response",
        message: "Backend вернул некорректный ответ replay команды Device Bridge.",
      });
}
