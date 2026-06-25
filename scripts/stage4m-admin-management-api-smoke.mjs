#!/usr/bin/env node
// Stage 4M · Admin management HTTPS API smoke.
// This intentionally creates one test clinic through the real production API,
// verifies it appears in the list, then edits it and verifies the updated row.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const DEFAULT_API_BASE_URL = "https://pro.skindoktor.ru";
const DEFAULT_CREDENTIALS_FILE = "/root/dermatolog-pro-admin-credentials.txt";
export const CREATE_TEST_CLINIC_CONFIRMATION = "I_CONFIRM_CREATE_TEST_CLINIC";

function parseCredentials(text) {
  const email = String(text || "").match(/^Email:\s*(.+)$/m)?.[1]?.trim();
  const password = String(text || "").match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!email || !password) throw new Error("Credentials file must include Email and Password lines.");
  return { email, password };
}

function makeSuffix() {
  return randomBytes(5).toString("hex");
}

function clinicPayload(suffix) {
  return {
    name: `Проверочная клиника ${suffix}`,
    address: `Проверочный адрес ${suffix}, Краснодар`,
    timezone: "Europe/Moscow",
  };
}

function updatedClinicPayload(suffix) {
  return {
    name: `Проверочная клиника ${suffix}`,
    address: `Проверочный адрес ${suffix}, Москва`,
    timezone: "Europe/Samara",
  };
}

export function redactSecrets(value, secrets = []) {
  let output = String(value || "");
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join("[redacted]");
  }
  return output.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
}

function apiUrl(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}${path}`;
}

export function parseStage4MAdminApiSmokeArgs(argv = [], env = process.env) {
  const parsed = {
    apiBaseUrl: env.STAGE4M_ADMIN_API_BASE_URL || env.VITE_SELF_HOSTED_API_BASE_URL || DEFAULT_API_BASE_URL,
    credentialsFile: env.STAGE4M_ADMIN_CREDENTIALS_FILE || DEFAULT_CREDENTIALS_FILE,
    confirmation: env.STAGE4M_CONFIRM_CREATE_TEST_CLINIC || "",
    suffix: env.STAGE4M_ADMIN_API_SMOKE_SUFFIX || makeSuffix(),
    help: false,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--api-base-url") {
      if (!next) parsed.errors.push("--api-base-url requires a value");
      else {
        parsed.apiBaseUrl = next;
        index += 1;
      }
    } else if (arg === "--credentials-file") {
      if (!next) parsed.errors.push("--credentials-file requires a value");
      else {
        parsed.credentialsFile = next;
        index += 1;
      }
    } else if (arg === "--confirm-create-test-clinic") {
      if (!next) parsed.errors.push("--confirm-create-test-clinic requires a value");
      else {
        parsed.confirmation = next;
        index += 1;
      }
    } else if (arg === "--suffix") {
      if (!next) parsed.errors.push("--suffix requires a value");
      else {
        parsed.suffix = String(next).trim();
        index += 1;
      }
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      parsed.errors.push(`Unknown argument: ${arg}`);
    }
  }

  if (!parsed.help) {
    if (!/^https?:\/\//i.test(parsed.apiBaseUrl)) parsed.errors.push("--api-base-url must start with http:// or https://");
    if (!parsed.credentialsFile) parsed.errors.push("--credentials-file is required");
    if (parsed.confirmation !== CREATE_TEST_CLINIC_CONFIRMATION) {
      parsed.errors.push(`--confirm-create-test-clinic must equal ${CREATE_TEST_CLINIC_CONFIRMATION}`);
    }
    if (!parsed.suffix || !/^[a-zA-Z0-9-]{3,40}$/.test(parsed.suffix)) {
      parsed.errors.push("--suffix must contain 3-40 latin letters, digits, or dashes");
    }
  }

  return parsed;
}

async function jsonRequest({ apiBaseUrl, path, token, payload, method = "GET", fetchImpl }) {
  const response = await fetchImpl(apiUrl(apiBaseUrl, path), {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.error?.code || `http_${response.status}`;
    const message = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed: ${response.status} ${code}: ${message}`);
  }
  return body;
}

function clinicItems(body) {
  return Array.isArray(body?.items) ? body.items : [];
}

function findClinic(items, clinicId) {
  return clinicItems(items).find((item) => item?.id === clinicId) || null;
}

export async function runStage4MAdminManagementApiSmoke({
  apiBaseUrl,
  credentialsFile,
  confirmation,
  suffix,
  fetchImpl = globalThis.fetch,
  readFile = readFileSync,
} = {}) {
  const config = parseStage4MAdminApiSmokeArgs([], {
    STAGE4M_ADMIN_API_BASE_URL: apiBaseUrl,
    STAGE4M_ADMIN_CREDENTIALS_FILE: credentialsFile,
    STAGE4M_CONFIRM_CREATE_TEST_CLINIC: confirmation,
    STAGE4M_ADMIN_API_SMOKE_SUFFIX: suffix,
  });
  if (config.errors.length) throw new Error(config.errors.join("\n"));
  if (typeof fetchImpl !== "function") throw new Error("This runtime does not provide fetch; use Node.js 18+.");

  const credentials = parseCredentials(readFile(config.credentialsFile, "utf8"));
  const login = await jsonRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: "/api/v1/auth/login",
    method: "POST",
    payload: { email: credentials.email, password: credentials.password },
    fetchImpl,
  });
  const token = login?.accessToken;
  if (!token) throw new Error("Admin login succeeded but accessToken is missing.");

  const before = await jsonRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: "/api/v1/admin/clinics",
    token,
    fetchImpl,
  });
  const beforeCount = clinicItems(before).length;

  const createPayload = clinicPayload(config.suffix);
  const created = await jsonRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: "/api/v1/admin/clinics",
    token,
    method: "POST",
    payload: createPayload,
    fetchImpl,
  });
  const createdClinic = created?.item;
  if (!createdClinic?.id) throw new Error("Create clinic response did not include item.id.");

  const afterCreate = await jsonRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: `/api/v1/admin/clinics?search=${encodeURIComponent(createPayload.name)}`,
    token,
    fetchImpl,
  });
  const createdInList = findClinic(afterCreate, createdClinic.id);
  if (!createdInList) throw new Error("Created clinic was not visible in the clinic list.");

  const updatePayload = updatedClinicPayload(config.suffix);
  await jsonRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: `/api/v1/admin/clinics/${encodeURIComponent(createdClinic.id)}`,
    token,
    method: "PATCH",
    payload: updatePayload,
    fetchImpl,
  });

  const afterUpdate = await jsonRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: `/api/v1/admin/clinics?search=${encodeURIComponent(updatePayload.name)}`,
    token,
    fetchImpl,
  });
  const updatedInList = findClinic(afterUpdate, createdClinic.id);
  if (!updatedInList || updatedInList.address !== updatePayload.address || updatedInList.timezone !== updatePayload.timezone) {
    throw new Error("Updated clinic row was not visible in the clinic list.");
  }

  return {
    ok: true,
    apiBaseUrl: config.apiBaseUrl,
    createdClinicVisibleInList: true,
    updatedClinicVisibleInList: true,
    beforeCount,
    createdClinic: {
      id: createdClinic.id,
      name: updatedInList.name,
      address: updatedInList.address,
      timezone: updatedInList.timezone,
    },
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-admin-management-api-smoke.mjs \\",
    "    --api-base-url https://pro.skindoktor.ru \\",
    "    --credentials-file /root/dermatolog-pro-admin-credentials.txt \\",
    `    --confirm-create-test-clinic ${CREATE_TEST_CLINIC_CONFIRMATION}`,
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseStage4MAdminApiSmokeArgs(argv);
  const secrets = [];
  try {
    if (parsed.help) {
      console.log(usage());
      return 0;
    }
    if (parsed.errors.length) throw new Error(parsed.errors.join("\n"));
    const credentialsText = readFileSync(parsed.credentialsFile, "utf8");
    const credentials = parseCredentials(credentialsText);
    secrets.push(credentials.password);
    const result = await runStage4MAdminManagementApiSmoke({
      apiBaseUrl: parsed.apiBaseUrl,
      credentialsFile: parsed.credentialsFile,
      confirmation: parsed.confirmation,
      suffix: parsed.suffix,
      readFile: () => credentialsText,
    });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(`[stage4m-admin-api-smoke] failed: ${redactSecrets(error?.message || error, secrets)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
