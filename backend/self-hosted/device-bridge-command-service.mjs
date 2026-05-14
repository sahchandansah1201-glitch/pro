// Stage 4R · Device Bridge command service.
// Converts UI requests into audited backend-owned commands. No browser hardware.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, deviceCommandScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BRIDGE_COMMANDS = new Set(["bridge_health_check"]);
const DEVICE_COMMANDS = new Set(["device_calibration_request", "device_stream_open_request"]);
const MAX_REASON_LENGTH = 240;

export class DeviceCommandValidationError extends Error {
  constructor(details = [], message = "Device command payload failed validation.") {
    super(message);
    this.name = "DeviceCommandValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class DeviceCommandNotFoundError extends Error {
  constructor(message = "Device Bridge resource was not found in the allowed clinic scope.") {
    super(message);
    this.name = "DeviceCommandNotFoundError";
    this.publicCode = "not_found";
    this.publicStatus = 404;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function assertUuid(value, field = "id") {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new DeviceCommandValidationError([{ field, message: `${field} must be a UUID.` }]);
  }
  return String(value);
}

function cleanReason(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, MAX_REASON_LENGTH) : null;
}

export function normalizeBridgeCommandPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new DeviceCommandValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const commandType = String(input.commandType || "").trim();
  const details = [];
  if (!BRIDGE_COMMANDS.has(commandType)) {
    details.push({ field: "commandType", message: "commandType must be bridge_health_check." });
  }
  if (details.length > 0) throw new DeviceCommandValidationError(details);
  return {
    commandType,
    reason: cleanReason(input.reason),
    payload: {
      requestedFrom: "sys_devices",
      expectedWorker: "local_device_bridge",
    },
  };
}

export function normalizeDeviceCommandPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new DeviceCommandValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const commandType = String(input.commandType || "").trim();
  const details = [];
  if (!DEVICE_COMMANDS.has(commandType)) {
    details.push({
      field: "commandType",
      message: "commandType must be device_calibration_request or device_stream_open_request.",
    });
  }
  if (details.length > 0) throw new DeviceCommandValidationError(details);
  return {
    commandType,
    reason: cleanReason(input.reason),
    payload: {
      requestedFrom: "sys_devices",
      expectedWorker: "local_device_bridge",
    },
  };
}

function ensureScopeAllowsClinic(scope, clinicId) {
  if (scope.allClinics) return;
  if (!clinicId || !scope.clinicIds.includes(clinicId)) {
    throw new ForbiddenError("Resource is outside the authenticated user's clinic scope.");
  }
}

function auditActionFor(commandType) {
  if (commandType === "bridge_health_check") return "device_bridge.command.create";
  if (commandType === "device_calibration_request") return "device.calibration.request";
  if (commandType === "device_stream_open_request") return "device.stream.request";
  return "device.command.create";
}

function commandModeFor(commandType) {
  if (commandType === "bridge_health_check") return "bridge_health_check";
  if (commandType === "device_calibration_request") return "calibration_request";
  if (commandType === "device_stream_open_request") return "stream_open_request";
  return "device_command";
}

function requireCommand(command) {
  if (!command) {
    throw new DeviceCommandNotFoundError("Device Bridge command could not be created.");
  }
  return command;
}

export function createDeviceBridgeCommandService({
  deviceBridgeCommandRepository,
  auditRepository,
} = {}) {
  return {
    async requestBridgeCommand(bridgeId, input, authContext, { correlationId } = {}) {
      const safeBridgeId = assertUuid(bridgeId, "bridgeId");
      const scope = deviceCommandScope(authContext);
      const payload = normalizeBridgeCommandPayload(input);
      const bridge = await deviceBridgeCommandRepository.getBridgeForCommand({
        bridgeId: safeBridgeId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!bridge) throw new DeviceCommandNotFoundError();
      ensureScopeAllowsClinic(scope, bridge.clinicId);
      const command = requireCommand(await deviceBridgeCommandRepository.createCommand({
        clinicId: bridge.clinicId,
        bridgeId: bridge.id,
        commandType: payload.commandType,
        requestedBy: authContext.userId,
        reason: payload.reason,
        payload: payload.payload,
      }));
      await recordAuditBestEffort(auditRepository, {
        clinicId: bridge.clinicId,
        actorUserId: authContext.userId,
        action: auditActionFor(payload.commandType),
        entityType: "device_bridge_command",
        entityId: command.id,
        correlationId,
        metadata: {
          bridgeId: bridge.id,
          commandType: payload.commandType,
          mode: commandModeFor(payload.commandType),
          allClinics: scope.allClinics,
        },
      });
      return {
        command,
        bridge,
        scope,
        mode: commandModeFor(payload.commandType),
      };
    },

    async requestDeviceCommand(deviceId, input, authContext, { correlationId } = {}) {
      const safeDeviceId = assertUuid(deviceId, "deviceId");
      const scope = deviceCommandScope(authContext);
      const payload = normalizeDeviceCommandPayload(input);
      const device = await deviceBridgeCommandRepository.getDeviceForCommand({
        deviceId: safeDeviceId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!device) throw new DeviceCommandNotFoundError("Device was not found in the allowed clinic scope.");
      ensureScopeAllowsClinic(scope, device.clinicId);
      if (!device.bridgeId) {
        throw new DeviceCommandValidationError([
          { field: "deviceId", message: "Device must be paired with a Device Bridge before commands can be queued." },
        ]);
      }
      const command = requireCommand(await deviceBridgeCommandRepository.createCommand({
        clinicId: device.clinicId,
        bridgeId: device.bridgeId,
        deviceId: device.id,
        commandType: payload.commandType,
        requestedBy: authContext.userId,
        reason: payload.reason,
        payload: payload.payload,
      }));
      await recordAuditBestEffort(auditRepository, {
        clinicId: device.clinicId,
        actorUserId: authContext.userId,
        action: auditActionFor(payload.commandType),
        entityType: "device_bridge_command",
        entityId: command.id,
        correlationId,
        metadata: {
          bridgeId: device.bridgeId,
          deviceId: device.id,
          commandType: payload.commandType,
          mode: commandModeFor(payload.commandType),
          allClinics: scope.allClinics,
        },
      });
      return {
        command,
        device,
        scope,
        mode: commandModeFor(payload.commandType),
      };
    },
  };
}
