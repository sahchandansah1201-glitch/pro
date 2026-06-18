import { buildSelfHostedApiUrl, type SelfHostedApiError, type SelfHostedApiResult } from "@/lib/self-hosted-patient-api";

export type ProductionBootstrapCheckStatus = "ready" | "attention" | "unknown";

export interface SelfHostedBootstrapDependency {
  name: string;
  configured: boolean;
  connected?: boolean;
  status: string;
  detail?: string;
}

export interface SelfHostedBootstrapStatus {
  health: {
    status: string;
    service: string;
  } | null;
  readiness: {
    ready: boolean;
    status: string;
    dependencies: SelfHostedBootstrapDependency[];
  } | null;
  meta: {
    stage: string;
    deploymentMode: string;
    capabilities: Record<string, string>;
  } | null;
}

export interface ProductionBootstrapChecklistItem {
  key: string;
  label: string;
  status: ProductionBootstrapCheckStatus;
  detail: string;
}

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateBaseUrl(baseUrl: string | null | undefined): SelfHostedApiError | null {
  const value = String(baseUrl ?? "").trim();
  if (!value) {
    return {
      kind: "validation",
      code: "base_url_required",
      message: "Укажите адрес системы клиники.",
    };
  }
  if (!/^https?:\/\//i.test(value)) {
    return {
      kind: "validation",
      code: "base_url_invalid",
      message: "Адрес системы должен начинаться с http:// или https://.",
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

async function fetchPublicJson(
  apiBaseUrl: string,
  path: string,
  allowHttpStatus: number[] = [],
): Promise<SelfHostedApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(apiBaseUrl, path), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к системе клиники.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok && !allowHttpStatus.includes(response.status)) {
    return fail({
      kind: "http",
      status: response.status,
      code: `http_${response.status}`,
      message: `Система клиники вернула HTTP ${response.status}.`,
      correlationId: isRecord(body) && typeof body.correlationId === "string" ? body.correlationId : undefined,
    });
  }
  return ok(body);
}

function toDependency(input: unknown): SelfHostedBootstrapDependency | null {
  if (!isRecord(input)) return null;
  const name = typeof input.name === "string" ? input.name : "";
  if (!name) return null;
  return {
    name,
    configured: Boolean(input.configured),
    connected: typeof input.connected === "boolean" ? input.connected : undefined,
    status: typeof input.status === "string" ? input.status : "unknown",
    detail: typeof input.detail === "string" ? input.detail : undefined,
  };
}

function toStatus(data: {
  health: unknown;
  readiness: unknown;
  meta: unknown;
}): SelfHostedBootstrapStatus {
  const health = isRecord(data.health)
    ? {
        status: typeof data.health.status === "string" ? data.health.status : "unknown",
        service: typeof data.health.service === "string" ? data.health.service : "система клиники",
      }
    : null;

  const readiness = isRecord(data.readiness)
    ? {
        ready: Boolean(data.readiness.ready),
        status: typeof data.readiness.status === "string" ? data.readiness.status : "unknown",
        dependencies: Array.isArray(data.readiness.dependencies)
          ? data.readiness.dependencies
              .map((item) => toDependency(item))
              .filter((item): item is SelfHostedBootstrapDependency => item != null)
          : [],
      }
    : null;

  const capabilities =
    isRecord(data.meta) && isRecord(data.meta.capabilities)
      ? Object.fromEntries(
          Object.entries(data.meta.capabilities).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : {};
  const meta = isRecord(data.meta)
    ? {
        stage: typeof data.meta.stage === "string" ? data.meta.stage : "unknown",
        deploymentMode: typeof data.meta.deploymentMode === "string" ? data.meta.deploymentMode : "unknown",
        capabilities,
      }
    : null;

  return { health, readiness, meta };
}

export async function fetchSelfHostedBootstrapStatus({
  apiBaseUrl,
}: {
  apiBaseUrl: string | null | undefined;
}): Promise<SelfHostedApiResult<SelfHostedBootstrapStatus>> {
  const baseUrlError = validateBaseUrl(apiBaseUrl);
  if (baseUrlError) return fail(baseUrlError);
  const base = String(apiBaseUrl ?? "").trim();

  const [health, readiness, meta] = await Promise.all([
    fetchPublicJson(base, "/healthz"),
    fetchPublicJson(base, "/readyz", [503]),
    fetchPublicJson(base, "/api/v1/meta"),
  ]);

  const firstError = [health, readiness, meta].find((result) => !result.ok);
  if (firstError && !firstError.ok && firstError.error) return fail(firstError.error);
  return ok(
    toStatus({
      health: health.value,
      readiness: readiness.value,
      meta: meta.value,
    }),
  );
}

function dependency(status: SelfHostedBootstrapStatus | null, name: string): SelfHostedBootstrapDependency | null {
  return status?.readiness?.dependencies.find((item) => item.name === name) ?? null;
}

export function buildProductionBootstrapChecklist(
  status: SelfHostedBootstrapStatus | null,
): ProductionBootstrapChecklistItem[] {
  const postgres = dependency(status, "postgres");
  const objectStorage = dependency(status, "object-storage");
  const jwt = dependency(status, "jwt-signing-key");

  return [
    {
      key: "backend",
      label: "Система клиники доступна",
      status: status?.health?.status === "ok" ? "ready" : "unknown",
      detail: status?.health?.status === "ok" ? "Система отвечает." : "Проверьте адрес системы клиники.",
    },
    {
      key: "postgres",
      label: "База данных подключена",
      status: postgres?.configured && postgres.connected ? "ready" : postgres?.configured ? "attention" : "unknown",
      detail: postgres?.configured && postgres.connected ? "База данных отвечает." : "Укажите рабочую базу данных клиники.",
    },
    {
      key: "object-storage",
      label: "Файлы клиники готовы",
      status: objectStorage?.configured ? "ready" : "unknown",
      detail: objectStorage?.configured ? "Файлы доступны." : "Настройте файлы клиники.",
    },
    {
      key: "auth",
      label: "Локальная авторизация включена",
      status: jwt?.configured && status?.meta?.capabilities.auth === "local-jwt" ? "ready" : "attention",
      detail: jwt?.configured ? "Ключ входа задан." : "Задайте локальный ключ входа в системе клиники.",
    },
    {
      key: "system-admin",
      label: "Первый администратор создан",
      status: "attention",
      detail: "Создайте первого администратора перед рабочим входом.",
    },
  ];
}
