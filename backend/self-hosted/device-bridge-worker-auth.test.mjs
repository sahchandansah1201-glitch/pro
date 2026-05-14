import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DeviceBridgeWorkerAuthError,
  authenticateDeviceBridgeWorker,
} from "./device-bridge-worker-auth.mjs";

const CONFIG = {
  deviceBridgeWorkerToken: "stage4s-worker-token",
};

test("authenticates worker bearer token without exposing user JWT roles", () => {
  const auth = authenticateDeviceBridgeWorker(
    { authorization: "Bearer stage4s-worker-token" },
    CONFIG,
  );

  assert.equal(auth.workerId, "local_device_bridge_worker");
  assert.equal(auth.authType, "device_bridge_worker_token");
  assert.equal(Object.hasOwn(auth, "roles"), false);
});

test("rejects missing config, missing bearer, and invalid bearer", () => {
  assert.throws(
    () => authenticateDeviceBridgeWorker({ authorization: "Bearer token" }, { deviceBridgeWorkerToken: "" }),
    (error) => error instanceof DeviceBridgeWorkerAuthError && error.publicCode === "worker_token_not_configured",
  );
  assert.throws(
    () => authenticateDeviceBridgeWorker({}, CONFIG),
    (error) => error instanceof DeviceBridgeWorkerAuthError && error.publicCode === "worker_auth_required",
  );
  assert.throws(
    () => authenticateDeviceBridgeWorker({ authorization: "Bearer wrong-token" }, CONFIG),
    (error) => error instanceof DeviceBridgeWorkerAuthError && error.publicCode === "worker_token_invalid",
  );
});
