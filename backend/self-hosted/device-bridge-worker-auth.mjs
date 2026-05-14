// Stage 4S · Device Bridge worker token boundary.
// This is a deployment-local worker token, not an end-user JWT.

import { timingSafeEqual } from "node:crypto";

import { extractBearerToken } from "./auth-tokens.mjs";

const MIN_WORKER_TOKEN_LENGTH = 16;

export class DeviceBridgeWorkerAuthError extends Error {
  constructor(code, message, status = 401) {
    super(message);
    this.name = "DeviceBridgeWorkerAuthError";
    this.publicCode = code;
    this.publicStatus = status;
  }
}

function safeTokenCompare(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertDeviceBridgeWorkerTokenConfigured(config = {}) {
  const token = String(config.deviceBridgeWorkerToken || "");
  if (token.length < MIN_WORKER_TOKEN_LENGTH) {
    throw new DeviceBridgeWorkerAuthError(
      "worker_token_not_configured",
      "DEVICE_BRIDGE_WORKER_TOKEN must be configured and at least 16 characters.",
      503,
    );
  }
  return token;
}

export function authenticateDeviceBridgeWorker(headers = {}, config = {}) {
  const expected = assertDeviceBridgeWorkerTokenConfigured(config);
  const provided = extractBearerToken(headers);
  if (!provided) {
    throw new DeviceBridgeWorkerAuthError(
      "worker_auth_required",
      "Device Bridge worker bearer token is required.",
      401,
    );
  }
  if (!safeTokenCompare(provided, expected)) {
    throw new DeviceBridgeWorkerAuthError(
      "worker_token_invalid",
      "Device Bridge worker bearer token is invalid.",
      401,
    );
  }
  return {
    workerId: "local_device_bridge_worker",
    authType: "device_bridge_worker_token",
  };
}
