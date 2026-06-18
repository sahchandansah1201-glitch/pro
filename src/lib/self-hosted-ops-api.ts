// Stage 4O · Self-hosted operations status client.
// Calls only the local self-hosted backend. No managed runtime coupling.

import {
  buildSelfHostedApiUrl,
  type SelfHostedApiError,
  type SelfHostedApiResult,
} from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface SelfHostedOpsDependency {
  name: string;
  configured: boolean;
  connected: boolean;
  status: string;
}

export interface SelfHostedOpsStatus {
  stage: "4N" | string;
  source: "self-hosted" | string;
  ready: boolean;
  status: "ready" | "degraded" | string;
  dependencies: SelfHostedOpsDependency[];
  observability: {
    structuredJsonLogs: boolean;
    correlationHeader: string;
    redaction: string;
    requestPathLogging: string;
  };
  audit: {
    mode: string;
    safeExport: string;
    exportedFields: string[];
  };
  auth: {
    userId: string;
    roles: string[];
  };
  generatedAt: string;
  correlationId: string;
}

export interface SelfHostedOpsRuntimeCheck {
  key: string;
  label: string;
  status: "ready" | "degraded" | "failed" | "warning" | string;
  detail: string;
  connected?: boolean;
  mode?: string;
  count?: number;
  expectedCount?: number;
  latest?: string;
  missing?: string[];
  totalBytes?: number;
  availableBytes?: number;
  usedPercent?: number | null;
}

export interface SelfHostedOpsCommand {
  key: string;
  label: string;
  command: string;
  description: string;
  status: string;
  dryRunOnly: boolean;
}

export interface SelfHostedOpsRuntimeChecks {
  stage: "4P" | string;
  source: "self-hosted" | string;
  ready: boolean;
  status: "ready" | "degraded" | "failed" | string;
  checks: SelfHostedOpsRuntimeCheck[];
  commands: SelfHostedOpsCommand[];
  auth: {
    userId: string;
    roles: string[];
  };
  generatedAt: string;
  correlationId: string;
}

export interface SelfHostedProductCapability {
  key: string;
  label: string;
  status: string;
  evidence: string[];
}

export interface SelfHostedProductGate {
  key: string;
  label: string;
  command: string;
  required: boolean;
}

export interface SelfHostedProductReadiness {
  stage: "4Z" | string;
  source: "self-hosted" | string;
  status: string;
  productBoundary: {
    deployment: string;
    frontend: string;
    backend: string;
    database: string;
    objectStorage: string;
    managedRuntime: string;
    managedDatabase: string;
    supabaseRuntimeCoupling: boolean;
    browserHardwareApis: boolean;
  };
  capabilities: SelfHostedProductCapability[];
  gates: SelfHostedProductGate[];
  openapi: string[];
  privacy: {
    redaction: string;
    exportedData: string;
    excluded: string[];
  };
  auth: {
    userId: string;
    roles: string[];
  };
  generatedAt: string;
  correlationId: string;
}

function opsPreviewLabel(value: string | undefined): string {
  if (!value) return "нет данных";
  const labels: Record<string, string> = {
    ready: "готово",
    degraded: "снижена готовность",
    failed: "ошибка",
    warning: "требует внимания",
    unknown: "нет данных",
    ready_for_server_deploy: "готово к установке",
    "Backup dry-run": "План резервной копии",
    "Deploy smoke dry-run": "Проверка развёртывания",
    "Plan backup": "Проверить план резервной копии",
    "Plan smoke": "Проверить план развёртывания",
    "Full deterministic preflight": "Полная предварительная проверка",
    "Self-hosted compose smoke": "Проверка состава системы",
  };
  return labels[value] ?? value;
}

function opsPreviewFieldLabel(value: string): string {
  const labels: Record<string, string> = {
    created_at: "дата события",
    action: "действие",
    entity_type: "тип объекта",
    entity_id: "код объекта",
    correlation_id: "код сверки",
  };
  return labels[value] ?? "служебное поле";
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Рабочая сессия не подключена.",
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
      message: "Укажите адрес сервера клиники.",
    };
  }
  return null;
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

function toStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];
}

function toDependency(input: unknown): SelfHostedOpsDependency | null {
  if (!isRecord(input)) return null;
  const name = typeof input.name === "string" ? input.name : "";
  if (!name) return null;
  return {
    name,
    configured: Boolean(input.configured),
    connected: Boolean(input.connected),
    status: typeof input.status === "string" ? input.status : "unknown",
  };
}

function toRuntimeCheck(input: unknown): SelfHostedOpsRuntimeCheck | null {
  if (!isRecord(input)) return null;
  const key = typeof input.key === "string" ? input.key : "";
  if (!key) return null;
  const rawUsedPercent = input.usedPercent;
  let usedPercent: number | null | undefined;
  if (typeof rawUsedPercent === "number") {
    usedPercent = rawUsedPercent;
  } else if (rawUsedPercent === null) {
    usedPercent = null;
  }
  return {
    key,
    label: typeof input.label === "string" ? input.label : key,
    status: typeof input.status === "string" ? input.status : "unknown",
    detail: typeof input.detail === "string" ? input.detail : "",
    connected: typeof input.connected === "boolean" ? input.connected : undefined,
    mode: typeof input.mode === "string" ? input.mode : undefined,
    count: typeof input.count === "number" ? input.count : undefined,
    expectedCount: typeof input.expectedCount === "number" ? input.expectedCount : undefined,
    latest: typeof input.latest === "string" ? input.latest : undefined,
    missing: Array.isArray(input.missing) ? toStringArray(input.missing) : undefined,
    totalBytes: typeof input.totalBytes === "number" ? input.totalBytes : undefined,
    availableBytes: typeof input.availableBytes === "number" ? input.availableBytes : undefined,
    usedPercent,
  };
}

function toCommand(input: unknown): SelfHostedOpsCommand | null {
  if (!isRecord(input)) return null;
  const key = typeof input.key === "string" ? input.key : "";
  const command = typeof input.command === "string" ? input.command : "";
  if (!key || !command) return null;
  return {
    key,
    label: typeof input.label === "string" ? input.label : key,
    command,
    description: typeof input.description === "string" ? input.description : "",
    status: typeof input.status === "string" ? input.status : "unknown",
    dryRunOnly: Boolean(input.dryRunOnly),
  };
}

function toProductCapability(input: unknown): SelfHostedProductCapability | null {
  if (!isRecord(input)) return null;
  const key = typeof input.key === "string" ? input.key : "";
  if (!key) return null;
  return {
    key,
    label: typeof input.label === "string" ? input.label : key,
    status: typeof input.status === "string" ? input.status : "unknown",
    evidence: toStringArray(input.evidence),
  };
}

function toProductGate(input: unknown): SelfHostedProductGate | null {
  if (!isRecord(input)) return null;
  const key = typeof input.key === "string" ? input.key : "";
  const command = typeof input.command === "string" ? input.command : "";
  if (!key || !command) return null;
  return {
    key,
    label: typeof input.label === "string" ? input.label : key,
    command,
    required: Boolean(input.required),
  };
}

export function toSelfHostedOpsStatus(input: unknown): SelfHostedOpsStatus | null {
  if (!isRecord(input)) return null;
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "self-hosted",
    ready: Boolean(input.ready),
    status: typeof input.status === "string" ? input.status : "unknown",
    dependencies: Array.isArray(input.dependencies)
      ? input.dependencies.map(toDependency).filter((item): item is SelfHostedOpsDependency => item != null)
      : [],
    observability: {
      structuredJsonLogs: Boolean(isRecord(input.observability) && input.observability.structuredJsonLogs),
      correlationHeader:
        isRecord(input.observability) && typeof input.observability.correlationHeader === "string"
          ? input.observability.correlationHeader
          : "x-correlation-id",
      redaction:
        isRecord(input.observability) && typeof input.observability.redaction === "string"
          ? input.observability.redaction
          : "unknown",
      requestPathLogging:
        isRecord(input.observability) && typeof input.observability.requestPathLogging === "string"
          ? input.observability.requestPathLogging
          : "unknown",
    },
    audit: {
      mode: isRecord(input.audit) && typeof input.audit.mode === "string" ? input.audit.mode : "unknown",
      safeExport:
        isRecord(input.audit) && typeof input.audit.safeExport === "string"
          ? input.audit.safeExport
          : "scripts/stage4n-audit-export.mjs --dry-run",
      exportedFields: isRecord(input.audit) ? toStringArray(input.audit.exportedFields) : [],
    },
    auth: {
      userId: isRecord(input.auth) && typeof input.auth.userId === "string" ? input.auth.userId : "",
      roles: isRecord(input.auth) ? toStringArray(input.auth.roles) : [],
    },
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
  };
}

export function toSelfHostedOpsRuntimeChecks(input: unknown): SelfHostedOpsRuntimeChecks | null {
  if (!isRecord(input)) return null;
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "self-hosted",
    ready: Boolean(input.ready),
    status: typeof input.status === "string" ? input.status : "unknown",
    checks: Array.isArray(input.checks)
      ? input.checks.map(toRuntimeCheck).filter((item): item is SelfHostedOpsRuntimeCheck => item != null)
      : [],
    commands: Array.isArray(input.commands)
      ? input.commands.map(toCommand).filter((item): item is SelfHostedOpsCommand => item != null)
      : [],
    auth: {
      userId: isRecord(input.auth) && typeof input.auth.userId === "string" ? input.auth.userId : "",
      roles: isRecord(input.auth) ? toStringArray(input.auth.roles) : [],
    },
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
  };
}

export function toSelfHostedProductReadiness(input: unknown): SelfHostedProductReadiness | null {
  if (!isRecord(input)) return null;
  const boundary = isRecord(input.productBoundary) ? input.productBoundary : {};
  const privacy = isRecord(input.privacy) ? input.privacy : {};
  return {
    stage: typeof input.stage === "string" ? input.stage : "unknown",
    source: typeof input.source === "string" ? input.source : "self-hosted",
    status: typeof input.status === "string" ? input.status : "unknown",
    productBoundary: {
      deployment: typeof boundary.deployment === "string" ? boundary.deployment : "single self-hosted product",
      frontend: typeof boundary.frontend === "string" ? boundary.frontend : "static React build served by nginx",
      backend: typeof boundary.backend === "string" ? boundary.backend : "Node self-hosted API",
      database: typeof boundary.database === "string" ? boundary.database : "operator-owned PostgreSQL",
      objectStorage:
        typeof boundary.objectStorage === "string" ? boundary.objectStorage : "operator-owned object storage",
      managedRuntime: typeof boundary.managedRuntime === "string" ? boundary.managedRuntime : "none",
      managedDatabase: typeof boundary.managedDatabase === "string" ? boundary.managedDatabase : "none",
      supabaseRuntimeCoupling: Boolean(boundary.supabaseRuntimeCoupling),
      browserHardwareApis: Boolean(boundary.browserHardwareApis),
    },
    capabilities: Array.isArray(input.capabilities)
      ? input.capabilities.map(toProductCapability).filter((item): item is SelfHostedProductCapability => item != null)
      : [],
    gates: Array.isArray(input.gates)
      ? input.gates.map(toProductGate).filter((item): item is SelfHostedProductGate => item != null)
      : [],
    openapi: toStringArray(input.openapi),
    privacy: {
      redaction: typeof privacy.redaction === "string" ? privacy.redaction : "enabled",
      exportedData: typeof privacy.exportedData === "string" ? privacy.exportedData : "metadata-only",
      excluded: toStringArray(privacy.excluded),
    },
    auth: {
      userId: isRecord(input.auth) && typeof input.auth.userId === "string" ? input.auth.userId : "",
      roles: isRecord(input.auth) ? toStringArray(input.auth.roles) : [],
    },
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
    correlationId: typeof input.correlationId === "string" ? input.correlationId : "",
  };
}

async function getJson<T>(
  args: BaseArgs,
  path: string,
  normalize: (input: unknown) => T | null,
): Promise<SelfHostedApiResult<T>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);

  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(args.apiBaseUrl, path), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.apiToken}`,
      },
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к серверу клиники.",
    });
  }

  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  const value = normalize(body);
  return value
    ? ok(value)
    : fail({
        kind: "http",
        code: "empty_response",
        message: "Рабочая система вернула пустой или неизвестный ответ.",
      });
}

export async function fetchSelfHostedOpsStatus(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedOpsStatus>> {
  return getJson(args, "/api/v1/ops/status", toSelfHostedOpsStatus);
}

export async function fetchSelfHostedOpsRuntimeChecks(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedOpsRuntimeChecks>> {
  return getJson(args, "/api/v1/ops/runtime-checks", toSelfHostedOpsRuntimeChecks);
}

export async function fetchSelfHostedProductReadiness(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedProductReadiness>> {
  return getJson(args, "/api/v1/product/readiness", toSelfHostedProductReadiness);
}

export const STAGE4O_AUDIT_EXPORT_COMMAND =
  "npm run ops:stage4n:audit-export:dry-run";

export function buildStage4OAuditExportPreview(status: SelfHostedOpsStatus | null): string {
  const fields = status?.audit.exportedFields?.length
    ? status.audit.exportedFields
    : ["created_at", "action", "entity_type", "entity_id", "correlation_id"];
  return [
    "# Предпросмотр экспорта аудита",
    "",
    "- Локальный запуск: команда скрыта с экрана администратора.",
    `- Контракт рабочей системы: ${status?.audit.safeExport ? "безопасная выгрузка включена" : "проверяется без вывода служебной команды"}`,
    `- Безопасные колонки: ${fields.map(opsPreviewFieldLabel).join(", ")}`,
    "- Не выгружаем: тела запросов, токены, пароли, имена пациентов, ключи объектов, пути хранения, сырые значения окружения",
    "",
  ].join("\n");
}

export function buildStage4POperationsPreview(runtime: SelfHostedOpsRuntimeChecks | null): string {
  const commands = runtime?.commands?.length
    ? runtime.commands
    : [
        {
          label: "План резервной копии",
          command: "npm run ops:stage4l:backup:dry-run",
          description: "Проверить план резервной копии",
          dryRunOnly: true,
        },
        {
          label: "План проверки развёртывания",
          command: "npm run smoke:stage4k:dry-run",
          description: "Проверить план развёртывания",
          dryRunOnly: true,
        },
      ];
  return [
    "# Предпросмотр операционного плана",
    "",
    `- Статус среды: ${opsPreviewLabel(runtime?.status ?? "unknown")}`,
    "- Область: интерфейс, рабочая система, база данных и файлы клиники",
    "- Внешняя управляемая база данных: нет",
    "",
    ...commands.flatMap((item) => [
      `## ${opsPreviewLabel(item.label)}`,
      "- Локальный запуск: команда скрыта с экрана администратора.",
      `- Только пробный запуск: ${item.dryRunOnly ? "да" : "нет"}`,
      `- Цель: ${opsPreviewLabel(item.description)}`,
      "",
    ]),
    "- Не выводим: тела запросов, токены, пароли, имена пациентов, ключи объектов, пути хранения, сырые значения окружения",
    "",
  ].join("\n");
}

export function buildStage4ZProductReadinessPreview(readiness: SelfHostedProductReadiness | null): string {
  const gates = readiness?.gates?.length
    ? readiness.gates
    : [
        { label: "Полная предварительная проверка", command: "npm run preflight:all", required: true },
        { label: "Проверка состава системы", command: "npm run smoke:stage4k", required: true },
      ];
  return [
    "# Предпросмотр готовности продукта",
    "",
    `- Статус: ${opsPreviewLabel(readiness?.status ?? "unknown")}`,
    "- Граница: интерфейс, рабочая система, база данных и файлы клиники",
    "- Управляемая внешняя среда: нет",
    "- Управляемая внешняя база: нет",
    "- Связь с внешней средой приложения: нет",
    "",
    ...gates.flatMap((item) => [
      `## ${opsPreviewLabel(item.label)}`,
      "- Локальный запуск: команда скрыта с экрана администратора.",
      `- Обязательно: ${item.required ? "да" : "нет"}`,
      "",
    ]),
    "- Не выводим: токены, пароли, имена пациентов, ключи объектов, пути хранения, подписанные ссылки, сырые значения окружения",
    "",
  ].join("\n");
}
