// Stage 4F · Self-hosted auth bridge.
// Wraps POST /api/v1/auth/login и GET /api/v1/auth/me. Не зависит от managed runtime.

import {
  buildSelfHostedApiUrl,
  type SelfHostedApiError,
  type SelfHostedApiResult,
} from "@/lib/self-hosted-patient-api";
import type { SelfHostedApiSessionUser } from "@/lib/self-hosted-api-session";

export interface SelfHostedLoginArgs {
  apiBaseUrl: string | null | undefined;
  email: string;
  password: string;
}

export interface SelfHostedLoginValue {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: SelfHostedApiSessionUser;
}

export interface SelfHostedMeArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeAuthErrorMessage(code: string, status: number, message: unknown): string {
  const byCode: Record<string, string> = {
    invalid_credentials: "Неверная эл. почта или пароль.",
    credentials_required: "Укажите эл. почту и пароль.",
    base_url_required: "Укажите адрес сервера клиники.",
    base_url_invalid: "Проверьте адрес сервера клиники.",
  };
  if (byCode[code]) return byCode[code];
  const text = typeof message === "string" ? message.trim() : "";
  if (text && !/[A-Za-z]/.test(text)) return text;
  if (status === 401) return "Неверная эл. почта или пароль.";
  return `Сервер клиники вернул HTTP ${status}.`;
}

function publicErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody = isRecord(body) && isRecord(body.error) ? body.error : null;
  const correlation = isRecord(body) && typeof body.correlationId === "string" ? body.correlationId : undefined;
  const code = errorBody && typeof errorBody.code === "string" ? errorBody.code : `http_${response.status}`;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code,
    message: safeAuthErrorMessage(code, response.status, errorBody?.message),
    correlationId: correlation,
  };
}

function rolesToList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const item of input) {
    if (typeof item === "string") {
      out.add(item);
      continue;
    }
    if (isRecord(item) && typeof item.role === "string") {
      out.add(item.role);
    }
  }
  return [...out];
}

function extractUser(input: unknown): SelfHostedApiSessionUser | null {
  if (!isRecord(input)) return null;
  const id = typeof input.id === "string" ? input.id : "";
  const displayName = typeof input.displayName === "string" ? input.displayName : "";
  if (!id) return null;
  return { id, displayName, roles: rolesToList(input.roles) };
}

function validateBaseUrl(baseUrl: string | null | undefined): SelfHostedApiError | null {
  const value = String(baseUrl ?? "").trim();
  if (!value) {
    return {
      kind: "validation",
      code: "base_url_required",
      message: "Укажите адрес сервера клиники.",
    };
  }
  if (!/^https?:\/\//i.test(value)) {
    return {
      kind: "validation",
      code: "base_url_invalid",
      message: "Адрес сервера должен начинаться с http:// или https://.",
    };
  }
  return null;
}

export async function loginToSelfHostedBackend(
  args: SelfHostedLoginArgs,
): Promise<SelfHostedApiResult<SelfHostedLoginValue>> {
  const email = String(args.email ?? "").trim();
  const password = String(args.password ?? "");
  if (!email || !password) {
    return fail({
      kind: "validation",
      code: "credentials_required",
      message: "Укажите эл. почту и пароль.",
    });
  }
  const baseUrlError = validateBaseUrl(args.apiBaseUrl);
  if (baseUrlError) return fail(baseUrlError);

  const url = buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/auth/login");
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к серверу клиники.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(publicErrorFromBody(response, body));

  const accessToken = isRecord(body) && typeof body.accessToken === "string" ? body.accessToken : "";
  if (!accessToken) {
    return fail({
      kind: "http",
      code: "empty_token",
      message: "Сервер клиники не вернул ключ входа.",
      status: response.status,
    });
  }
  const tokenType = isRecord(body) && typeof body.tokenType === "string" ? body.tokenType : "Bearer";
  const expiresInSeconds =
    isRecord(body) && typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : 3600;
  const user = extractUser(isRecord(body) ? body.user : null) ?? {
    id: "self-hosted-user",
    displayName: email,
    roles: [],
  };
  return ok({ accessToken, tokenType, expiresInSeconds, user });
}

export async function fetchSelfHostedMe(
  args: SelfHostedMeArgs,
): Promise<SelfHostedApiResult<SelfHostedApiSessionUser>> {
  if (!args.apiToken) {
    return fail({
      kind: "not_configured",
      code: "not_configured",
      message: "Сессия системы клиники не подключена.",
    });
  }
  const baseUrlError = validateBaseUrl(args.apiBaseUrl);
  if (baseUrlError) return fail(baseUrlError);

  const url = buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/auth/me");
  let response: Response;
  try {
    response = await fetch(url, {
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
  if (!response.ok) return fail(publicErrorFromBody(response, body));

  const user = extractUser(isRecord(body) ? body.user : null);
  if (!user) {
    return fail({
      kind: "http",
      code: "empty_response",
      message: "Сервер клиники не вернул карточку пользователя.",
    });
  }
  return ok(user);
}
