import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATE_TEST_CLINIC_CONFIRMATION,
  parseStage4MAdminApiSmokeArgs,
  redactSecrets,
  runStage4MAdminManagementApiSmoke,
} from "./stage4m-admin-management-api-smoke.mjs";

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Stage 4M admin API smoke parser requires explicit mutation confirmation", () => {
  const parsed = parseStage4MAdminApiSmokeArgs([
    "--api-base-url",
    "https://pro.example.test",
    "--credentials-file",
    "/root/creds.txt",
    "--suffix",
    "manual-001",
  ], {});

  assert.ok(parsed.errors.some((error) => error.includes(CREATE_TEST_CLINIC_CONFIRMATION)));
  const confirmed = parseStage4MAdminApiSmokeArgs([
    "--api-base-url",
    "https://pro.example.test",
    "--credentials-file",
    "/root/creds.txt",
    "--suffix",
    "manual-001",
    "--confirm-create-test-clinic",
    CREATE_TEST_CLINIC_CONFIRMATION,
  ], {});
  assert.deepEqual(confirmed.errors, []);
});

test("Stage 4M admin API smoke logs in, creates clinic, lists it, edits it and lists update", async () => {
  const calls = [];
  const clinicId = "clinic-api-smoke-1";
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/v1/auth/login")) {
      return responseJson({ accessToken: "secret-token" });
    }
    if (url.endsWith("/api/v1/admin/clinics") && init.method === "GET") {
      return responseJson({ items: [] });
    }
    if (url.endsWith("/api/v1/admin/clinics") && init.method === "POST") {
      return responseJson({ item: { id: clinicId, name: "Проверочная клиника api-001" } }, 201);
    }
    if (url.includes("/api/v1/admin/clinics?search=")) {
      const isUpdated = calls.some((call) => call.init.method === "PATCH");
      return responseJson({
        items: [
          {
            id: clinicId,
            name: "Проверочная клиника api-001",
            address: isUpdated ? "Проверочный адрес api-001, Москва" : "Проверочный адрес api-001, Краснодар",
            timezone: isUpdated ? "Europe/Samara" : "Europe/Moscow",
          },
        ],
      });
    }
    if (url.endsWith(`/api/v1/admin/clinics/${clinicId}`) && init.method === "PATCH") {
      return responseJson({ item: { id: clinicId } });
    }
    throw new Error(`Unexpected request: ${init.method} ${url}`);
  };

  const result = await runStage4MAdminManagementApiSmoke({
    apiBaseUrl: "https://pro.example.test",
    credentialsFile: "/root/creds.txt",
    confirmation: CREATE_TEST_CLINIC_CONFIRMATION,
    suffix: "api-001",
    fetchImpl,
    readFile: () => "Email: admin@example.test\nPassword: secret-password\n",
  });

  assert.equal(result.ok, true);
  assert.equal(result.createdClinicVisibleInList, true);
  assert.equal(result.updatedClinicVisibleInList, true);
  assert.equal(calls.length, 6);
  assert.equal(JSON.parse(calls[0].init.body).password, "secret-password");
  assert.equal(calls[1].init.headers.Authorization, "Bearer secret-token");
  assert.equal(JSON.parse(calls[2].init.body).address, "Проверочный адрес api-001, Краснодар");
  assert.equal(JSON.parse(calls[4].init.body).timezone, "Europe/Samara");
});

test("Stage 4M admin API smoke fails when created clinic is absent from list", async () => {
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/api/v1/auth/login")) return responseJson({ accessToken: "secret-token" });
    if (url.endsWith("/api/v1/admin/clinics") && init.method === "GET") return responseJson({ items: [] });
    if (url.endsWith("/api/v1/admin/clinics") && init.method === "POST") {
      return responseJson({ item: { id: "clinic-api-smoke-1" } }, 201);
    }
    if (url.includes("/api/v1/admin/clinics?search=")) return responseJson({ items: [] });
    throw new Error(`Unexpected request: ${init.method} ${url}`);
  };

  await assert.rejects(
    () =>
      runStage4MAdminManagementApiSmoke({
        apiBaseUrl: "https://pro.example.test",
        credentialsFile: "/root/creds.txt",
        confirmation: CREATE_TEST_CLINIC_CONFIRMATION,
        suffix: "api-002",
        fetchImpl,
        readFile: () => "Email: admin@example.test\nPassword: secret-password\n",
      }),
    /Created clinic was not visible/,
  );
});

test("Stage 4M admin API smoke redacts password and bearer tokens", () => {
  const redacted = redactSecrets("Bearer abc.def secret-password", ["secret-password"]);

  assert.equal(redacted, "Bearer [redacted-token] [redacted]");
});
