// Stage 4S · Device Bridge worker service.
// A local worker polls and completes backend-owned commands through a token-only boundary.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { authenticateDeviceBridgeWorker } from "./device-bridge-worker-auth.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BRIDGE_CODE_LENGTH = 80;
const MAX_HOST_LENGTH = 120;
const MAX_VERSION_LENGTH = 48;
const MAX_MESSAGE_LENGTH = 500;
const MAX_RESULT_KEYS = 20;
const SENSITIVE_KEY_PATTERN = /(token|secret|password|cookie|signed|signature|object[_-]?key|storage[_-]?path|patient[_-]?name|email)/i;

export class DeviceBridgeWorkerValidationError extends Error {
  constructor(details = [], message = "Device Bridge worker payload failed validation.") {
    super(message);
    this.name = "DeviceBridgeWorkerValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class DeviceBridgeWorkerCommandNotFoundError extends Error {
  constructor(message = "Device Bridge command was not found for this worker bridge.") {
    super(message);
    this.name = "DeviceBridgeWorkerCommandNotFoundError";
    this.publicCode = "command_not_found";
    this.publicStatus = 404;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertUuid(value, field) {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new DeviceBridgeWorkerValidationError([{ field, message: `${field} must be a UUID.` }]);
  }
  return String(value);
}

function cleanText(value, fallback, maxLength) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return (text || fallback).slice(0, maxLength);
}

function normalizeBridgeCode(value) {
  const bridgeCode = cleanText(value, "", MAX_BRIDGE_CODE_LENGTH);
  if (!bridgeCode) {
    throw new DeviceBridgeWorkerValidationError([
      { field: "bridgeCode", message: "bridgeCode is required." },
    ]);
  }
  return bridgeCode;
}

function normalizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 50);
}

function sanitizeWorkerResult(value, depth = 0) {
  if (depth > 2) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeWorkerResult(item, depth + 1));
  }
  if (!isPlainObject(value)) {
    if (typeof value === "string") return value.slice(0, MAX_MESSAGE_LENGTH);
    if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
    return String(value).slice(0, MAX_MESSAGE_LENGTH);
  }
  const sanitized = {};
  for (const [key, raw] of Object.entries(value).slice(0, MAX_RESULT_KEYS)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = sanitizeWorkerResult(raw, depth + 1);
  }
  return sanitized;
}

export function normalizeWorkerHeartbeat(input = {}) {
  if (!isPlainObject(input)) {
    throw new DeviceBridgeWorkerValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  return {
    clinicId: assertUuid(input.clinicId, "clinicId"),
    bridgeCode: normalizeBridgeCode(input.bridgeCode),
    hostName: cleanText(input.hostName, "local-device-bridge", MAX_HOST_LENGTH),
    version: cleanText(input.version, "unknown", MAX_VERSION_LENGTH),
    lanStatus: normalizeStatus(input.lanStatus, ["online", "degraded", "offline"], "online"),
    workerStatus: normalizeStatus(input.workerStatus, ["online", "degraded", "offline"], "online"),
    metadata: sanitizeWorkerResult(input.metadata || {}),
  };
}

export function normalizeWorkerCommandQuery(searchParams = new URLSearchParams()) {
  return {
    clinicId: assertUuid(searchParams.get("clinicId"), "clinicId"),
    bridgeCode: normalizeBridgeCode(searchParams.get("bridgeCode")),
    limit: normalizeLimit(searchParams.get("limit")),
  };
}

export function normalizeWorkerCommandUpdate(input = {}) {
  if (!isPlainObject(input)) {
    throw new DeviceBridgeWorkerValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const status = normalizeStatus(input.status, ["acknowledged", "completed", "failed"], "");
  if (!status) {
    throw new DeviceBridgeWorkerValidationError([
      { field: "status", message: "status must be acknowledged, completed, or failed." },
    ]);
  }
  return {
    clinicId: assertUuid(input.clinicId, "clinicId"),
    bridgeCode: normalizeBridgeCode(input.bridgeCode),
    status,
    result: {
      status,
      message: input.message ? cleanText(input.message, "", MAX_MESSAGE_LENGTH) : null,
      payload: sanitizeWorkerResult(input.result || {}),
    },
  };
}

function auditActionForStatus(status) {
  return status === "acknowledged"
    ? "device_bridge.command.ack"
    : "device_bridge.command.complete";
}

function requireCommand(command) {
  if (!command) throw new DeviceBridgeWorkerCommandNotFoundError();
  return command;
}

export function createDeviceBridgeWorkerService({
  config,
  deviceBridgeWorkerRepository,
  auditRepository,
} = {}) {
  return {
    async recordHeartbeat(headers, input, { correlationId } = {}) {
      const worker = authenticateDeviceBridgeWorker(headers, config);
      const payload = normalizeWorkerHeartbeat(input);
      const bridge = await deviceBridgeWorkerRepository.recordHeartbeat(payload);
      await recordAuditBestEffort(auditRepository, {
        clinicId: payload.clinicId,
        actorUserId: null,
        action: "device_bridge.worker.heartbeat",
        entityType: "device_bridge",
        entityId: bridge?.id || null,
        correlationId,
        metadata: {
          bridgeCode: payload.bridgeCode,
          workerId: worker.workerId,
          workerStatus: payload.workerStatus,
          lanStatus: payload.lanStatus,
        },
      });
      return { worker, bridge, heartbeat: payload };
    },

    async listCommands(headers, searchParams, { correlationId } = {}) {
      const worker = authenticateDeviceBridgeWorker(headers, config);
      const query = normalizeWorkerCommandQuery(searchParams);
      const commands = await deviceBridgeWorkerRepository.listCommands(query);
      await recordAuditBestEffort(auditRepository, {
        clinicId: query.clinicId,
        actorUserId: null,
        action: "device_bridge.command.poll",
        entityType: "device_bridge_command",
        correlationId,
        metadata: {
          bridgeCode: query.bridgeCode,
          workerId: worker.workerId,
          count: commands.length,
          limit: query.limit,
        },
      });
      return { worker, query, commands };
    },

    async updateCommandStatus(commandId, headers, input, { correlationId } = {}) {
      const worker = authenticateDeviceBridgeWorker(headers, config);
      const payload = normalizeWorkerCommandUpdate(input);
      const command = requireCommand(await deviceBridgeWorkerRepository.updateCommandStatus({
        commandId: assertUuid(commandId, "commandId"),
        clinicId: payload.clinicId,
        bridgeCode: payload.bridgeCode,
        status: payload.status,
        result: payload.result,
      }));
      await recordAuditBestEffort(auditRepository, {
        clinicId: payload.clinicId,
        actorUserId: null,
        action: auditActionForStatus(payload.status),
        entityType: "device_bridge_command",
        entityId: command.id,
        correlationId,
        metadata: {
          bridgeCode: payload.bridgeCode,
          workerId: worker.workerId,
          status: payload.status,
        },
      });
      return { worker, command, status: payload.status };
    },
  };
}
