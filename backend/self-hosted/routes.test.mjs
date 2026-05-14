import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { DatabaseUnavailableError } from "./db-client.mjs";
import { ForbiddenError } from "./rbac.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const NOW = () => "2026-05-13T00:00:00.000Z";

function createRuntime({
  connected = true,
  patients = [],
  patientError = null,
  bridges = [],
  devices = [],
  deviceError = null,
  deviceCommandResult = null,
  deviceCommandError = null,
  patientDetail = null,
  createdPatient = null,
  updatedPatient = null,
  archivedPatient = null,
  authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    displayName: "Demo Doctor",
    roles: ["doctor"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [
      {
        role: "doctor",
        clinicId: "10000000-0000-4000-8000-000000000001",
        clinicSlug: "demo-clinic",
      },
    ],
    token: { issuedAt: 1, expiresAt: 3601 },
  },
  authError = null,
  loginError = null,
  auditEvents = [],
} = {}) {
  return {
    dbClient: {
      async checkConnection() {
        if (!connected) {
          throw new DatabaseUnavailableError("PostgreSQL password=secret failed");
        }
        return { connected: true, detail: "PostgreSQL connection verified" };
      },
    },
    authService: {
      async login() {
        if (loginError) throw loginError;
        return {
          tokenType: "Bearer",
          accessToken: "header.payload.signature",
          expiresInSeconds: 3600,
          user: {
            id: authContext.userId,
            displayName: authContext.displayName,
            roles: authContext.roleBindings,
          },
        };
      },
      async authenticate() {
        if (authError) throw authError;
        return authContext;
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
    patientRepository: {
      async listPatients(params) {
        if (patientError) throw patientError;
        return {
          items: patients,
          count: patients.length,
          limit: params.limit,
          offset: params.offset,
          search: params.search,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
      async getPatient() {
        if (patientError) throw patientError;
        return patientDetail;
      },
      async createPatient() {
        if (patientError) throw patientError;
        return createdPatient;
      },
      async updatePatient() {
        if (patientError) throw patientError;
        return updatedPatient;
      },
      async archivePatient() {
        if (patientError) throw patientError;
        return archivedPatient;
      },
    },
    deviceRegistryRepository: {
      async listDeviceBridges(params) {
        if (deviceError) throw deviceError;
        return {
          items: bridges,
          count: bridges.length,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
      async listMedicalDevices(params) {
        if (deviceError) throw deviceError;
        return {
          items: devices,
          count: devices.length,
          limit: params.limit,
          offset: params.offset,
          search: params.search,
          status: params.status,
          needsCalibration: params.needsCalibration,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
    },
    deviceBridgeCommandService: {
      async requestBridgeCommand() {
        if (deviceCommandError) throw deviceCommandError;
        return deviceCommandResult || {
          command: {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: null,
            commandType: "bridge_health_check",
            status: "queued",
          },
          bridge: {
            id: "10000000-0000-4000-8000-000000000301",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeCode: "br-live-01",
          },
          scope: { allClinics: false, clinicIds: ["10000000-0000-4000-8000-000000000001"], roles: authContext.roles },
          mode: "bridge_health_check",
        };
      },
      async requestDeviceCommand() {
        if (deviceCommandError) throw deviceCommandError;
        return deviceCommandResult || {
          command: {
            id: "10000000-0000-4000-8000-000000000902",
            clinicId: "10000000-0000-4000-8000-000000000001",
            bridgeId: "10000000-0000-4000-8000-000000000301",
            deviceId: "10000000-0000-4000-8000-000000000401",
            commandType: "device_calibration_request",
            status: "queued",
          },
          device: {
            id: "10000000-0000-4000-8000-000000000401",
            clinicId: "10000000-0000-4000-8000-000000000001",
            serial: "DL5-AX-1042",
            bridgeId: "10000000-0000-4000-8000-000000000301",
          },
          scope: { allClinics: false, clinicIds: ["10000000-0000-4000-8000-000000000001"], roles: authContext.roles },
          mode: "calibration_request",
        };
      },
    },
  };
}

async function request(
  path,
  env = {},
  runtime = createRuntime(),
  method = "GET",
  body = undefined,
) {
  const config = readSelfHostedConfig(env);
  const response = await handleSelfHostedRequest(
    {
      method,
      url: path,
      headers: {
        origin: "http://localhost:8080",
        authorization: "Bearer header.payload.signature",
      },
      body,
    },
    config,
    NOW,
    runtime,
  );
  return {
    ...response,
    json: response.headers?.["content-type"]?.includes("application/json") && response.body
      ? JSON.parse(response.body)
      : null,
  };
}

const configuredEnv = {
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "stage4c-local-test-secret",
};

test("healthz returns a safe self-hosted service status", async () => {
  const response = await request("/healthz", configuredEnv);

  assert.equal(response.status, 200);
  assert.equal(response.json.status, "ok");
  assert.equal(response.json.deploymentMode, "self-hosted");
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user/i);
});

test("readyz reports degraded until database and object storage are configured", async () => {
  const degraded = await request("/readyz", {}, createRuntime());
  assert.equal(degraded.status, 503);
  assert.equal(degraded.json.status, "degraded");
  assert.equal(degraded.json.dependencies.length, 3);

  const unavailable = await request(
    "/readyz",
    configuredEnv,
    createRuntime({ connected: false }),
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.status, "degraded");
  assert.equal(
    unavailable.json.dependencies.find((item) => item.name === "postgres").status,
    "unavailable",
  );
  assert.doesNotMatch(unavailable.body, /secret|postgres:\/\//);

  const ready = await request("/readyz", configuredEnv, createRuntime());
  assert.equal(ready.status, 200);
  assert.equal(ready.json.status, "ready");
  assert.equal(
    ready.json.dependencies.find((item) => item.name === "postgres").status,
    "connected",
  );
  assert.doesNotMatch(ready.body, /secret|app/);
});

test("meta and openapi routes expose contracts without runtime secrets", async () => {
  const meta = await request("/api/v1/meta", {
    ...configuredEnv,
    OBJECT_STORAGE_BUCKET: "medical-assets",
  });
  assert.equal(meta.status, 200);
  assert.equal(meta.json.stage, "4R");
  assert.equal(meta.json.capabilities.auth, "local-jwt");
  assert.equal(meta.json.capabilities.patients, "rbac-read-write-postgres");
  assert.equal(meta.json.capabilities.devices, "rbac-read-command-postgres-device-bridge-registry");
  assert.equal(meta.json.capabilities.observability, "structured-json-logs-redacted-ops-status-runtime-checks");
  assert.equal(meta.json.links.openapi, "/openapi.stage4r.json");
  assert.equal(meta.json.links.openapiStage4A, "/openapi.stage4a.json");
  assert.equal(meta.json.links.openapiStage4B, "/openapi.stage4b.json");
  assert.equal(meta.json.links.openapiStage4C, "/openapi.stage4c.json");
  assert.equal(meta.json.links.openapiStage4H, "/openapi.stage4h.json");
  assert.equal(meta.json.links.openapiStage4I, "/openapi.stage4i.json");
  assert.equal(meta.json.links.openapiStage4J, "/openapi.stage4j.json");
  assert.equal(meta.json.links.openapiStage4N, "/openapi.stage4n.json");
  assert.equal(meta.json.links.openapiStage4P, "/openapi.stage4p.json");
  assert.equal(meta.json.links.openapiStage4Q, "/openapi.stage4q.json");
  assert.equal(meta.json.links.openapiStage4R, "/openapi.stage4r.json");
  assert.equal(meta.json.links.opsStatus, "/api/v1/ops/status");
  assert.equal(meta.json.links.opsRuntimeChecks, "/api/v1/ops/runtime-checks");
  assert.equal(meta.json.links.deviceBridges, "/api/v1/device-bridges");
  assert.equal(meta.json.links.deviceBridgeCommands, "/api/v1/device-bridges/{bridgeId}/commands");
  assert.equal(meta.json.links.devices, "/api/v1/devices");
  assert.equal(meta.json.links.deviceCommands, "/api/v1/devices/{deviceId}/commands");
  assert.equal(meta.json.links.assetDownloadUrl, "/api/v1/assets/{assetId}/download-url");
  assert.equal(meta.json.links.assetDownload, "/api/v1/assets/{assetId}/download");
  assert.equal(meta.json.service.objectStorageBucket, "medical-assets");
  assert.doesNotMatch(meta.body, /secret|postgres:\/\//);

  const openapi4a = await request("/openapi.stage4a.json");
  assert.equal(openapi4a.status, 200);
  assert.equal(openapi4a.json.info.version, "4A-foundation");

  const openapi4b = await request("/openapi.stage4b.json");
  assert.equal(openapi4b.status, 200);
  assert.equal(openapi4b.json.info.version, "4B-runtime");
  assert.equal(
    openapi4b.json.paths["/api/v1/patients"].get.responses["200"].description,
    "Read-only patient list from PostgreSQL",
  );

  const openapi4c = await request("/openapi.stage4c.json");
  assert.equal(openapi4c.status, 200);
  assert.equal(openapi4c.json.info.version, "4C-auth-rbac");
  assert.equal(openapi4c.json.components.securitySchemes.bearerAuth.scheme, "bearer");

  const openapi4d = await request("/openapi.stage4d.json");
  assert.equal(openapi4d.status, 200);
  assert.equal(openapi4d.json.info.version, "4D-patient-writes");
  assert.equal(openapi4d.json.paths["/api/v1/patients"].post.responses["201"].description, "Patient created");

  const openapi4h = await request("/openapi.stage4h.json");
  assert.equal(openapi4h.status, 200);
  assert.equal(openapi4h.json.info.version, "4H-visit-workspace-writes");
  assert.ok(openapi4h.json.paths["/api/v1/visits/{visitId}/report"].patch);

  const openapi4i = await request("/openapi.stage4i.json");
  assert.equal(openapi4i.status, 200);
  assert.equal(openapi4i.json.info.version, "4I-assets-write");
  assert.ok(openapi4i.json.paths["/api/v1/assets/{assetId}/download-url"].get);

  const openapi4j = await request("/openapi.stage4j.json");
  assert.equal(openapi4j.status, 200);
  assert.equal(openapi4j.json.info.version, "4J-asset-binaries");
  assert.ok(openapi4j.json.paths["/api/v1/assets/{assetId}/download"].get);

  const openapi4n = await request("/openapi.stage4n.json");
  assert.equal(openapi4n.status, 200);
  assert.equal(openapi4n.json.info.version, "4N-production-observability-audit");
  assert.ok(openapi4n.json.paths["/api/v1/ops/status"].get);

  const openapi4p = await request("/openapi.stage4p.json");
  assert.equal(openapi4p.status, 200);
  assert.equal(openapi4p.json.info.version, "4P-ops-runtime-checks");
  assert.ok(openapi4p.json.paths["/api/v1/ops/runtime-checks"].get);

  const openapi4q = await request("/openapi.stage4q.json");
  assert.equal(openapi4q.status, 200);
  assert.equal(openapi4q.json.info.version, "4Q-device-registry");

  const openapi4r = await request("/openapi.stage4r.json");
  assert.equal(openapi4r.status, 200);
  assert.equal(openapi4r.json.info.version, "4R-device-bridge-commands");
  assert.ok(openapi4q.json.paths["/api/v1/devices"].get);
  assert.ok(openapi4q.json.paths["/api/v1/device-bridges"].get);
});

test("ops status is system-admin only, safe, audited, and correlation-aware", async () => {
  const auditEvents = [];
  const systemAdminRuntime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request("/api/v1/ops/status", configuredEnv, systemAdminRuntime);

  assert.equal(response.status, 200);
  assert.equal(response.headers["x-correlation-id"], "stage4i-local");
  assert.equal(response.json.stage, "4N");
  assert.equal(response.json.source, "self-hosted");
  assert.equal(response.json.observability.structuredJsonLogs, true);
  assert.equal(response.json.observability.correlationHeader, "x-correlation-id");
  assert.equal(response.json.audit.mode, "append-only");
  assert.equal(response.json.auth.roles[0], "system_admin");
  assert.equal(auditEvents[0].action, "ops.status.read");
  assert.doesNotMatch(response.body, /secret|postgres:\/\/|password|Bearer|object_key|storage_object_path|patient_full_name|Demo Patient/i);

  const denied = await request(
    "/api/v1/ops/status",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000102",
        displayName: "Clinic Admin",
        roles: ["clinic_admin"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
        token: {},
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");

  const anonymous = await request(
    "/api/v1/ops/status",
    configuredEnv,
    createRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");
});

test("ops runtime checks are system-admin only, safe, audited, and self-hosted", async () => {
  const auditEvents = [];
  const systemAdminRuntime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000999",
      displayName: "System Admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null, clinicSlug: null }],
      token: {},
    },
  });
  const response = await request(
    "/api/v1/ops/runtime-checks",
    configuredEnv,
    systemAdminRuntime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["x-correlation-id"], "stage4i-local");
  assert.equal(response.json.stage, "4P");
  assert.equal(response.json.source, "self-hosted");
  assert.ok(response.json.checks.some((item) => item.key === "postgres_connectivity"));
  assert.ok(response.json.checks.some((item) => item.key === "object_storage_runtime"));
  assert.ok(response.json.checks.some((item) => item.key === "migration_bundle"));
  assert.ok(response.json.commands.some((item) => item.command === "npm run ops:stage4l:backup:dry-run"));
  assert.ok(response.json.commands.some((item) => item.command === "npm run smoke:stage4k:dry-run"));
  assert.equal(response.json.auth.roles[0], "system_admin");
  assert.equal(auditEvents[0].action, "ops.runtime_checks.read");
  assert.doesNotMatch(
    response.body,
    /secret|postgres:\/\/|password|Bearer|object_key|storage_object_path|patient_full_name|Demo Patient/i,
  );

  const denied = await request(
    "/api/v1/ops/runtime-checks",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000102",
        displayName: "Clinic Admin",
        roles: ["clinic_admin"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
        token: {},
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4Q · device registry endpoints are RBAC-scoped, audited, and safe", async () => {
  const auditEvents = [];
  const clinicAdminRuntime = createRuntime({
    auditEvents,
    authContext: {
      userId: "10000000-0000-4000-8000-000000000102",
      displayName: "Clinic Admin",
      roles: ["clinic_admin"],
      clinicIds: ["10000000-0000-4000-8000-000000000001"],
      roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
      token: {},
    },
    bridges: [
      {
        id: "10000000-0000-4000-8000-000000000301",
        bridgeCode: "br-msk-01",
        hostName: "dp-bridge-msk-01",
        lanStatus: "online",
        version: "1.0.0",
        pairedCount: 2,
        lastHeartbeatAt: "2026-05-14T08:00:00.000Z",
      },
    ],
    devices: [
      {
        id: "10000000-0000-4000-8000-000000000401",
        model: "DermLite DL5",
        serial: "DL5-AX-1042",
        firmware: "2.4.1",
        magnification: "x10",
        polarization: "polarized",
        calibrationProfile: "DL5-std-A",
        calibrationDueAt: "2026-05-20",
        status: "connected",
        lastSeenAt: "2026-05-14T08:00:00.000Z",
        bridgeId: "10000000-0000-4000-8000-000000000301",
        bridge: {
          id: "10000000-0000-4000-8000-000000000301",
          code: "br-msk-01",
          hostName: "dp-bridge-msk-01",
          lanStatus: "online",
        },
      },
    ],
  });

  const bridges = await request("/api/v1/device-bridges?bridgeStatus=online", configuredEnv, clinicAdminRuntime);
  assert.equal(bridges.status, 200);
  assert.equal(bridges.json.stage, "4Q");
  assert.equal(bridges.json.items[0].bridgeCode, "br-msk-01");
  assert.equal(bridges.json.auth.allClinics, false);
  assert.equal(auditEvents[0].action, "device_bridge.list");
  assert.doesNotMatch(bridges.body, /secret|password|Bearer|object_key|storage_object_path|metadata_json|patient_full_name/i);

  const devices = await request(
    "/api/v1/devices?status=connected&needsCalibration=true&search=DL5",
    configuredEnv,
    clinicAdminRuntime,
  );
  assert.equal(devices.status, 200);
  assert.equal(devices.json.stage, "4Q");
  assert.equal(devices.json.items[0].serial, "DL5-AX-1042");
  assert.equal(devices.json.status, "connected");
  assert.equal(devices.json.needsCalibration, true);
  assert.equal(auditEvents[1].action, "device.list");
  assert.doesNotMatch(devices.body, /secret|password|Bearer|object_key|storage_object_path|metadata_json|patient_full_name/i);

  const denied = await request(
    "/api/v1/devices",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "10000000-0000-4000-8000-000000000101",
        displayName: "Demo Doctor",
        roles: ["doctor"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [{ role: "doctor", clinicId: "10000000-0000-4000-8000-000000000001" }],
        token: {},
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4R · Device Bridge command endpoints queue safe backend-owned commands", async () => {
  const clinicAdminRuntime = createRuntime({
    authContext: {
      userId: "10000000-0000-4000-8000-000000000102",
      displayName: "Clinic Admin",
      roles: ["clinic_admin"],
      clinicIds: ["10000000-0000-4000-8000-000000000001"],
      roleBindings: [{ role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000001" }],
      token: {},
    },
  });

  const bridgeCommand = await request(
    "/api/v1/device-bridges/10000000-0000-4000-8000-000000000301/commands",
    configuredEnv,
    clinicAdminRuntime,
    "POST",
    JSON.stringify({ commandType: "bridge_health_check", reason: "Проверка LAN" }),
  );
  assert.equal(bridgeCommand.status, 202);
  assert.equal(bridgeCommand.json.stage, "4R");
  assert.equal(bridgeCommand.json.command.commandType, "bridge_health_check");
  assert.equal(bridgeCommand.json.execution.worker, "local_device_bridge");
  assert.equal(bridgeCommand.json.execution.browserHardwareAccess, false);
  assert.doesNotMatch(bridgeCommand.body, /secret|password|Bearer|object_key|storage_object_path|metadata_json|navigator\./i);

  const deviceCommand = await request(
    "/api/v1/devices/10000000-0000-4000-8000-000000000401/commands",
    configuredEnv,
    clinicAdminRuntime,
    "POST",
    JSON.stringify({ commandType: "device_calibration_request" }),
  );
  assert.equal(deviceCommand.status, 202);
  assert.equal(deviceCommand.json.command.deviceId, "10000000-0000-4000-8000-000000000401");
  assert.equal(deviceCommand.json.mode, "calibration_request");
});

test("Stage 4R · Device Bridge command endpoints map RBAC and validation errors safely", async () => {
  const denied = await request(
    "/api/v1/device-bridges/10000000-0000-4000-8000-000000000301/commands",
    configuredEnv,
    createRuntime({ deviceCommandError: new ForbiddenError() }),
    "POST",
    JSON.stringify({ commandType: "bridge_health_check" }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");

  const invalid = await request(
    "/api/v1/devices/10000000-0000-4000-8000-000000000401/commands",
    configuredEnv,
    createRuntime(),
    "POST",
    "{bad-json",
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalid.json.error.code, "invalid_json");
  assert.doesNotMatch(invalid.body, /postgres:\/\/|SUPABASE_|navigator\.usb/i);
});

test("auth login returns a bearer token without leaking password material", async () => {
  const response = await request(
    "/api/v1/auth/login",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ email: "doctor.demo@example.invalid", password: "demo-password" }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.tokenType, "Bearer");
  assert.equal(response.json.user.displayName, "Demo Doctor");
  assert.equal(response.json.user.roles[0].role, "doctor");
  assert.doesNotMatch(response.body, /demo-password|passwordHash|\$scrypt|secret/i);
});

test("auth me returns role bindings for an authenticated bearer token", async () => {
  const response = await request("/api/v1/auth/me", configuredEnv, createRuntime());

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.user.displayName, "Demo Doctor");
  assert.equal(response.json.user.roles[0].clinicSlug, "demo-clinic");
  assert.equal(response.json.token.expiresAt, 3601);
});

test("patients list returns role-scoped read-only PostgreSQL data and audit metadata", async () => {
  const patients = [
    {
      id: "10000000-0000-4000-8000-000000000201",
      code: "DP-DEMO-0001",
      fullName: "Demo Patient One",
      birthDate: "1984-02-14",
      sex: "female",
      phototype: "II",
      imagingConsent: true,
      clinic: { slug: "demo-clinic", name: "Dermatolog Pro Demo Clinic" },
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
    },
  ];
  const auditEvents = [];
  const response = await request(
    "/api/v1/patients?limit=1&offset=2&search=Demo",
    configuredEnv,
    createRuntime({ patients, auditEvents }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.limit, 1);
  assert.equal(response.json.offset, 2);
  assert.equal(response.json.search, "Demo");
  assert.equal(response.json.clinicIds[0], "10000000-0000-4000-8000-000000000001");
  assert.equal(response.json.auth.roles[0], "doctor");
  assert.equal(response.json.items[0].fullName, "Demo Patient One");
  assert.equal(auditEvents[0].action, "patient.list");
  assert.doesNotMatch(response.body, /storage_object_path|access_token|postgres:\/\/|secret/i);
});

test("patients list maps database failures to safe JSON errors", async () => {
  const response = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({
      patientError: new DatabaseUnavailableError(
        "PostgreSQL failed for postgres://user:secret@postgres:5432/app",
      ),
    }),
  );

  assert.equal(response.status, 503);
  assert.equal(response.json.error.code, "database_unavailable");
  assert.equal(
    response.json.error.message,
    "Database is unavailable for the self-hosted backend.",
  );
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user|app/);
});

test("patients list requires auth and rejects roles without patient-read access", async () => {
  const anonymous = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");
  assert.equal(
    anonymous.json.error.message,
    "Authentication is required for this endpoint.",
  );

  const denied = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "operator-1",
        displayName: "Operator",
        roles: ["operator"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
        token: {},
      },
      authError: new ForbiddenError(),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
  assert.equal(
    denied.json.error.message,
    "The authenticated user does not have access to this resource.",
  );
});

test("patient detail returns role-scoped data and audit event", async () => {
  const auditEvents = [];
  const response = await request(
    "/api/v1/patients/10000000-0000-4000-8000-000000000201",
    configuredEnv,
    createRuntime({
      auditEvents,
      patientDetail: {
        id: "10000000-0000-4000-8000-000000000201",
        code: "DP-DEMO-0001",
        fullName: "Demo Patient One",
        birthDate: "1984-02-14",
        sex: "female",
        phototype: "II",
        imagingConsent: true,
        notes: "detail note",
        clinic: {
          id: "10000000-0000-4000-8000-000000000001",
          slug: "demo-clinic",
          name: "Dermatolog Pro Demo Clinic",
        },
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.item.notes, "detail note");
  assert.equal(auditEvents[0].action, "patient.read");
});

test("patient write routes create, update, and archive with audit-safe responses", async () => {
  const auditEvents = [];
  const basePatient = {
    id: "10000000-0000-4000-8000-000000000201",
    code: "DP-DEMO-0001",
    fullName: "Demo Patient One",
    birthDate: "1984-02-14",
    sex: "female",
    phototype: "II",
    imagingConsent: true,
    notes: null,
    clinic: {
      id: "10000000-0000-4000-8000-000000000001",
      slug: "demo-clinic",
      name: "Dermatolog Pro Demo Clinic",
    },
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  };
  const runtime = createRuntime({
    auditEvents,
    createdPatient: basePatient,
    updatedPatient: { ...basePatient, fullName: "Updated Patient" },
    archivedPatient: { ...basePatient, deletedAt: "2026-05-13T00:00:00.000Z" },
  });

  const created = await request(
    "/api/v1/patients",
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ fullName: "Demo Patient One", birthDate: "1984-02-14" }),
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.stage, "4D");
  assert.equal(created.json.item.id, basePatient.id);

  const updated = await request(
    `/api/v1/patients/${basePatient.id}`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ fullName: "Updated Patient" }),
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.fullName, "Updated Patient");

  const archived = await request(
    `/api/v1/patients/${basePatient.id}`,
    configuredEnv,
    runtime,
    "DELETE",
    JSON.stringify({ reason: "duplicate" }),
  );
  assert.equal(archived.status, 200);
  assert.equal(archived.json.archived, true);
  assert.equal(auditEvents.map((event) => event.action).join(","), "patient.create,patient.update,patient.archive");
  assert.doesNotMatch(archived.body, /password_hash|storage_object_path|access_token|postgres:\/\/|secret/i);
});

test("patient write routes validate payload, auth, and clinic scope safely", async () => {
  const invalid = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ fullName: "Only" }),
  );
  assert.equal(invalid.status, 422);
  assert.equal(invalid.json.error.code, "validation_error");
  assert.equal(invalid.json.error.details[0].field, "fullName");

  const malformed = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    "{bad json",
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, "invalid_json");

  const forbiddenClinic = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000099",
      fullName: "Demo Patient",
    }),
  );
  assert.equal(forbiddenClinic.status, 403);
  assert.equal(forbiddenClinic.json.error.code, "forbidden");
});

test("unknown routes and unsupported methods return the common JSON error shape", async () => {
  const missing = await request("/missing");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "not_found");
  assert.equal(typeof missing.json.error.message, "string");
  assert.equal(missing.json.correlationId, "stage4i-local");

  const post = await request("/api/v1/meta", {}, createRuntime(), "POST");
  assert.equal(post.status, 405);
  assert.equal(post.json.error.code, "method_not_allowed");

  const put = await request(
    "/api/v1/patients/10000000-0000-4000-8000-000000000201",
    configuredEnv,
    createRuntime(),
    "PUT",
  );
  assert.equal(put.status, 405);
  assert.equal(put.json.error.code, "method_not_allowed");
});

// =====================================================================
// Stage 4G · self-hosted visit workspace read endpoints
// =====================================================================

function visitWorkspaceRuntime({
  visitsByPatient = [],
  visit = null,
  lesions = [],
  assets = [],
  authContext,
  auditEvents = [],
  authError,
} = {}) {
  return {
    ...createRuntime({ authContext, auditEvents, authError }),
    visitWorkspaceRepository: {
      async listVisitsByPatient() {
        return visitsByPatient;
      },
      async getVisit() {
        return visit;
      },
      async listVisitLesions() {
        return lesions;
      },
      async listVisitAssets() {
        return assets;
      },
    },
  };
}

function visitWorkspaceWriteRuntime({
  updatedVisit = null,
  createdLesion = null,
  updatedLesion = null,
  archivedLesion = null,
  upsertedReport = null,
  authContext,
  auditEvents = [],
  authError,
  writeError = null,
} = {}) {
  return {
    ...visitWorkspaceRuntime({ authContext, auditEvents, authError }),
    visitWorkspaceWriteService: {
      async updateVisit() {
        if (writeError) throw writeError;
        return { visit: updatedVisit, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async createLesion() {
        if (writeError) throw writeError;
        return { lesion: createdLesion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async updateLesion() {
        if (writeError) throw writeError;
        return { lesion: updatedLesion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async archiveLesion() {
        if (writeError) throw writeError;
        return { lesion: archivedLesion, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
      async updateReport() {
        if (writeError) throw writeError;
        return { report: upsertedReport, scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] } };
      },
    },
  };
}

function assetWriteRuntime({
  createdAsset = null,
  download = null,
  authContext,
  auditEvents = [],
  authError,
  assetError = null,
} = {}) {
  return {
    ...visitWorkspaceRuntime({ authContext, auditEvents, authError }),
    assetWriteService: {
      async createVisitAsset() {
        if (assetError) throw assetError;
        return {
          asset: createdAsset,
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
      async getAssetDownloadUrl() {
        if (assetError) throw assetError;
        return {
          ...download,
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
      async downloadAsset() {
        if (assetError) throw assetError;
        return {
          asset: download?.asset || {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: STAGE4G_CLINIC_ID,
            visitId: STAGE4G_VISIT_ID,
            contentType: "image/png",
          },
          object: {
            bytes: Buffer.from("asset-binary"),
            byteSize: Buffer.byteLength("asset-binary"),
            contentType: "image/png",
          },
          scope: { allClinics: false, clinicIds: [STAGE4G_CLINIC_ID] },
        };
      },
    },
  };
}

const STAGE4G_VISIT_ID = "10000000-0000-4000-8000-000000000301";
const STAGE4G_PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const STAGE4G_CLINIC_ID = "10000000-0000-4000-8000-000000000001";

test("Stage 4G · GET /api/v1/patients/{id}/visits returns role-scoped read-only data", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    visitsByPatient: [
      {
        id: STAGE4G_VISIT_ID,
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        doctorUserId: "10000000-0000-4000-8000-000000000101",
        status: "in_progress",
        startedAt: "2026-05-12T09:00:00.000Z",
        signedAt: null,
        chiefComplaint: "follow-up",
        createdAt: "2026-05-12T09:00:00.000Z",
        updatedAt: "2026-05-12T09:00:00.000Z",
      },
    ],
  });
  const response = await request(
    `/api/v1/patients/${STAGE4G_PATIENT_ID}/visits`,
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4G");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.count, 1);
  assert.equal(response.json.items[0].status, "in_progress");
  assert.equal(auditEvents[0].action, "visit.list");
  assert.doesNotMatch(response.body, /password|object_key|signed url|secret/i);
});

test("Stage 4G · GET /api/v1/visits/{id} returns visit detail and audit", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    visit: {
      id: STAGE4G_VISIT_ID,
      clinicId: STAGE4G_CLINIC_ID,
      patientId: STAGE4G_PATIENT_ID,
      doctorUserId: null,
      status: "in_progress",
      startedAt: "2026-05-12T09:00:00.000Z",
      signedAt: null,
      chiefComplaint: null,
      createdAt: "2026-05-12T09:00:00.000Z",
      updatedAt: "2026-05-12T09:00:00.000Z",
      patient: { id: STAGE4G_PATIENT_ID, fullName: "Demo Patient One", code: "DP-DEMO-0001" },
      clinic: { id: STAGE4G_CLINIC_ID, slug: "demo-clinic", name: "Dermatolog Pro Demo Clinic" },
    },
  });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    runtime,
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.item.patient.fullName, "Demo Patient One");
  assert.equal(response.json.item.clinic.slug, "demo-clinic");
  assert.equal(auditEvents[0].action, "visit.read");
});

test("Stage 4G · visit detail returns 404 when not in scope", async () => {
  const runtime = visitWorkspaceRuntime({ visit: null });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    runtime,
  );
  assert.equal(response.status, 404);
  assert.equal(response.json.error.code, "visit_not_found");
});

test("Stage 4G · GET /api/v1/visits/{id}/lesions returns lesion list and audit", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    lesions: [
      {
        id: "lesion-1",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        label: "L1",
        bodyZone: "спина",
        bodySurface: null,
        status: "active",
        riskLevel: "moderate",
        createdAt: "2026-05-12T09:00:00.000Z",
        updatedAt: "2026-05-12T09:00:00.000Z",
      },
    ],
  });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/lesions`,
    configuredEnv,
    runtime,
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.items[0].label, "L1");
  assert.equal(auditEvents[0].action, "visit.lesions");
});

test("Stage 4G · GET /api/v1/visits/{id}/assets returns metadata only", async () => {
  const auditEvents = [];
  const runtime = visitWorkspaceRuntime({
    auditEvents,
    assets: [
      {
        id: "asset-1",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        lesionId: "lesion-1",
        kind: "dermoscopy",
        contentType: "image/jpeg",
        byteSize: 2048,
        capturedAt: "2026-05-12T09:00:00.000Z",
        uploadedBy: "10000000-0000-4000-8000-000000000101",
        createdAt: "2026-05-12T09:00:00.000Z",
      },
    ],
  });
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/assets`,
    configuredEnv,
    runtime,
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.items[0].kind, "dermoscopy");
  assert.doesNotMatch(response.body, /object_bucket|object_key|signed/i);
  assert.equal(auditEvents[0].action, "visit.assets");
});

test("Stage 4G · visit endpoints require auth and reject roles without read scope", async () => {
  const anonymous = await request(
    `/api/v1/patients/${STAGE4G_PATIENT_ID}/visits`,
    configuredEnv,
    visitWorkspaceRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");

  const denied = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/lesions`,
    configuredEnv,
    visitWorkspaceRuntime({
      authContext: { userId: "u", displayName: "X", roles: ["operator"], clinicIds: [], roleBindings: [], token: {} },
      authError: new ForbiddenError(),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4G · invalid uuid in path is rejected with validation error", async () => {
  const response = await request(
    "/api/v1/visits/not-a-uuid/lesions",
    configuredEnv,
    visitWorkspaceRuntime(),
  );
  assert.equal(response.status, 422);
  assert.equal(response.json.error.code, "validation_error");
});

test("Stage 4G · /openapi.stage4g.json documents the new visit workspace endpoints", async () => {
  const response = await request("/openapi.stage4g.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "4G-visit-workspace");
  assert.ok(response.json.paths["/api/v1/patients/{patientId}/visits"]);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}"]);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/lesions"]);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/assets"]);
});

test("Stage 4G · /api/v1/meta exposes current self-hosted capabilities and links", async () => {
  const response = await request("/api/v1/meta", configuredEnv);
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4R");
  assert.equal(response.json.capabilities.visits, "rbac-read-write-postgres");
  assert.equal(response.json.capabilities.lesions, "rbac-read-write-postgres");
  assert.equal(response.json.capabilities.assets, "rbac-read-write-postgres-backend-url-local-object-store");
  assert.equal(response.json.capabilities.observability, "structured-json-logs-redacted-ops-status-runtime-checks");
  assert.equal(response.json.links.openapiStage4G, "/openapi.stage4g.json");
  assert.equal(response.json.links.openapiStage4H, "/openapi.stage4h.json");
  assert.equal(response.json.links.openapiStage4I, "/openapi.stage4i.json");
  assert.equal(response.json.links.openapiStage4J, "/openapi.stage4j.json");
  assert.equal(response.json.links.openapiStage4N, "/openapi.stage4n.json");
  assert.equal(response.json.links.openapiStage4P, "/openapi.stage4p.json");
  assert.equal(response.json.links.openapiStage4Q, "/openapi.stage4q.json");
  assert.equal(response.json.links.openapiStage4R, "/openapi.stage4r.json");
  assert.equal(response.json.links.opsStatus, "/api/v1/ops/status");
  assert.equal(response.json.links.opsRuntimeChecks, "/api/v1/ops/runtime-checks");
  assert.equal(response.json.links.deviceBridges, "/api/v1/device-bridges");
  assert.equal(response.json.links.deviceBridgeCommands, "/api/v1/device-bridges/{bridgeId}/commands");
  assert.equal(response.json.links.devices, "/api/v1/devices");
  assert.equal(response.json.links.deviceCommands, "/api/v1/devices/{deviceId}/commands");
  assert.equal(response.json.links.visit, "/api/v1/visits/{visitId}");
  assert.equal(response.json.links.visitReport, "/api/v1/visits/{visitId}/report");
  assert.equal(response.json.links.assetDownloadUrl, "/api/v1/assets/{assetId}/download-url");
  assert.equal(response.json.links.assetDownload, "/api/v1/assets/{assetId}/download");
});

// =====================================================================
// Stage 4I · self-hosted clinical asset write/download-url endpoints
// =====================================================================

test("Stage 4I · POST /api/v1/visits/{id}/assets registers metadata only", async () => {
  const asset = {
    id: "10000000-0000-4000-8000-000000000901",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    lesionId: null,
    kind: "overview_photo",
    contentType: "image/png",
    byteSize: 4096,
    capturedAt: "2026-05-12T09:00:00.000Z",
    uploadedBy: "10000000-0000-4000-8000-000000000101",
    createdAt: "2026-05-12T09:00:01.000Z",
  };
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/assets`,
    configuredEnv,
    assetWriteRuntime({ createdAsset: asset }),
    "POST",
    JSON.stringify({ kind: "overview", contentType: "image/png", byteSize: 4096 }),
  );
  assert.equal(response.status, 201);
  assert.equal(response.json.stage, "4I");
  assert.equal(response.json.item.kind, "overview_photo");
  assert.equal(response.json.upload.objectStorage, "backend-owned");
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|signed|access_token/i);
});

test("Stage 4I · GET /api/v1/assets/{id}/download-url returns backend route only", async () => {
  const assetId = "10000000-0000-4000-8000-000000000901";
  const response = await request(
    `/api/v1/assets/${assetId}/download-url?expiresIn=120`,
    configuredEnv,
    assetWriteRuntime({
      download: {
        asset: { id: assetId, clinicId: STAGE4G_CLINIC_ID, visitId: STAGE4G_VISIT_ID },
        download: {
          assetId,
          clinicId: STAGE4G_CLINIC_ID,
          visitId: STAGE4G_VISIT_ID,
          downloadUrl: `/api/v1/assets/${assetId}/download`,
          expiresIn: 120,
          expiresAt: "2026-05-13T00:02:00.000Z",
        },
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4I");
  assert.equal(response.json.item.downloadUrl, `/api/v1/assets/${assetId}/download`);
  assert.equal(response.json.item.expiresIn, 120);
  assert.doesNotMatch(response.body, /object_bucket|object_key|storage_object_path|sig=|access_token/i);
});

test("Stage 4I · /openapi.stage4i.json documents asset write contract", async () => {
  const response = await request("/openapi.stage4i.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "4I-assets-write");
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/assets"].post);
  assert.ok(response.json.paths["/api/v1/assets/{assetId}/download-url"].get);
});

test("Stage 4J · GET /api/v1/assets/{id}/download streams bytes with safe headers", async () => {
  const assetId = "10000000-0000-4000-8000-000000000901";
  const response = await request(
    `/api/v1/assets/${assetId}/download`,
    configuredEnv,
    assetWriteRuntime({
      download: {
        asset: {
          id: assetId,
          clinicId: STAGE4G_CLINIC_ID,
          visitId: STAGE4G_VISIT_ID,
          contentType: "image/png",
        },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "image/png");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(String(response.body), "asset-binary");
  assert.doesNotMatch(String(response.headers["content-disposition"]), /object|bucket|key|storage/i);
});

// =====================================================================
// Stage 4H · self-hosted visit workspace write endpoints
// =====================================================================

test("Stage 4H · PATCH /api/v1/visits/{id} updates visit JSON fields", async () => {
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    visitWorkspaceWriteRuntime({
      updatedVisit: {
        id: STAGE4G_VISIT_ID,
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        status: "in_progress",
        chiefComplaint: "контроль динамики",
      },
    }),
    "PATCH",
    JSON.stringify({ chiefComplaint: "контроль динамики" }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4H");
  assert.equal(response.json.item.chiefComplaint, "контроль динамики");
  assert.doesNotMatch(response.body, /password_hash|object_key|access_token|postgres:\/\/|secret/i);
});

test("Stage 4H · lesion create, update and soft archive routes return audit-safe JSON", async () => {
  const lesion = {
    id: "10000000-0000-4000-8000-000000000401",
    clinicId: STAGE4G_CLINIC_ID,
    patientId: STAGE4G_PATIENT_ID,
    visitId: STAGE4G_VISIT_ID,
    label: "L1",
    status: "active",
  };
  const runtime = visitWorkspaceWriteRuntime({
    createdLesion: lesion,
    updatedLesion: { ...lesion, label: "L2", riskLevel: "moderate" },
    archivedLesion: { ...lesion, status: "archived", deletedAt: "2026-05-13T00:00:00.000Z" },
  });

  const created = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/lesions`,
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ label: "L1", riskLevel: "moderate" }),
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.item.label, "L1");

  const updated = await request(
    `/api/v1/lesions/${lesion.id}`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ label: "L2" }),
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.label, "L2");

  const archived = await request(
    `/api/v1/lesions/${lesion.id}`,
    configuredEnv,
    runtime,
    "DELETE",
    JSON.stringify({ reason: "duplicate" }),
  );
  assert.equal(archived.status, 200);
  assert.equal(archived.json.archived, true);
  assert.equal(archived.json.item.status, "archived");
  assert.doesNotMatch(archived.body, /object_bucket|object_key|signed|storage_object_path/i);
});

test("Stage 4H · PATCH /api/v1/visits/{id}/report upserts report text", async () => {
  const response = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/report`,
    configuredEnv,
    visitWorkspaceWriteRuntime({
      upsertedReport: {
        id: "10000000-0000-4000-8000-000000000501",
        clinicId: STAGE4G_CLINIC_ID,
        patientId: STAGE4G_PATIENT_ID,
        visitId: STAGE4G_VISIT_ID,
        status: "draft",
        physicianText: "Описание для врача",
        patientSafeText: "Рекомендован контроль у врача.",
      },
    }),
    "PATCH",
    JSON.stringify({
      physicianText: "Описание для врача",
      patientSafeText: "Рекомендован контроль у врача.",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4H");
  assert.equal(response.json.item.patientSafeText, "Рекомендован контроль у врача.");
});

test("Stage 4H · write routes validate JSON and RBAC", async () => {
  const malformed = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}/report`,
    configuredEnv,
    visitWorkspaceWriteRuntime(),
    "PATCH",
    "{bad json",
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, "invalid_json");

  const denied = await request(
    `/api/v1/visits/${STAGE4G_VISIT_ID}`,
    configuredEnv,
    visitWorkspaceWriteRuntime({
      authContext: { userId: "admin-1", displayName: "Admin", roles: ["clinic_admin"], clinicIds: [STAGE4G_CLINIC_ID], roleBindings: [], token: {} },
      authError: new ForbiddenError(),
    }),
    "PATCH",
    JSON.stringify({ chiefComplaint: "x" }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
});

test("Stage 4H · /openapi.stage4h.json documents write endpoints", async () => {
  const response = await request("/openapi.stage4h.json");
  assert.equal(response.status, 200);
  assert.equal(response.json.info.version, "4H-visit-workspace-writes");
  assert.ok(response.json.paths["/api/v1/visits/{visitId}"].patch);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/lesions"].post);
  assert.ok(response.json.paths["/api/v1/lesions/{lesionId}"].delete);
  assert.ok(response.json.paths["/api/v1/visits/{visitId}/report"].patch);
});
