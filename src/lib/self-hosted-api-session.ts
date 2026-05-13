import { useEffect, useState } from "react";

export const SELF_HOSTED_API_BASE_URL_KEY = "derma-pro:self-hosted-api-base-url";
export const SELF_HOSTED_API_TOKEN_KEY = "derma-pro:self-hosted-api-token";
export const SELF_HOSTED_API_USER_KEY = "derma-pro:self-hosted-api-user";
export const SELF_HOSTED_API_SESSION_EVENT = "derma-pro:self-hosted-api-session";

export interface SelfHostedApiSessionUser {
  id: string;
  displayName: string;
  roles: string[];
}

export interface SelfHostedApiSession {
  apiBaseUrl: string;
  apiToken: string | null;
  user: SelfHostedApiSessionUser | null;
  status: "configured" | "missing_token";
}

function envBaseUrl(): string {
  return String(import.meta.env.VITE_SELF_HOSTED_API_BASE_URL ?? "").trim();
}

function readStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null || value === "") window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* swallow: storage may be unavailable */
  }
}

function parseUser(raw: string | null): SelfHostedApiSessionUser | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SelfHostedApiSessionUser> | null;
    if (!data || typeof data !== "object") return null;
    const id = typeof data.id === "string" ? data.id : "";
    const displayName = typeof data.displayName === "string" ? data.displayName : "";
    const roles = Array.isArray(data.roles)
      ? data.roles.filter((r): r is string => typeof r === "string")
      : [];
    if (!id) return null;
    return { id, displayName, roles };
  } catch {
    return null;
  }
}

export function readSelfHostedApiSession(): SelfHostedApiSession {
  const apiBaseUrl = (readStoredValue(SELF_HOSTED_API_BASE_URL_KEY) ?? envBaseUrl()).replace(/\/+$/, "");
  const apiToken = readStoredValue(SELF_HOSTED_API_TOKEN_KEY);
  const user = parseUser(readStoredValue(SELF_HOSTED_API_USER_KEY));
  return {
    apiBaseUrl,
    apiToken,
    user,
    status: apiToken ? "configured" : "missing_token",
  };
}

export function isSelfHostedApiConfigured(session: SelfHostedApiSession): boolean {
  return session.status === "configured" && Boolean(session.apiToken);
}

export interface WriteSelfHostedApiSessionInput {
  apiBaseUrl?: string | null;
  apiToken: string;
  user?: SelfHostedApiSessionUser | null;
}

function emitSessionChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(SELF_HOSTED_API_SESSION_EVENT));
  } catch {
    /* swallow: events unavailable in test env */
  }
}

export function writeSelfHostedApiSession(input: WriteSelfHostedApiSessionInput): void {
  if (typeof input.apiBaseUrl === "string") {
    const trimmed = input.apiBaseUrl.trim().replace(/\/+$/, "");
    writeStoredValue(SELF_HOSTED_API_BASE_URL_KEY, trimmed || null);
  }
  writeStoredValue(SELF_HOSTED_API_TOKEN_KEY, input.apiToken);
  if (input.user) {
    writeStoredValue(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({
        id: input.user.id,
        displayName: input.user.displayName,
        roles: input.user.roles,
      }),
    );
  } else if (input.user === null) {
    writeStoredValue(SELF_HOSTED_API_USER_KEY, null);
  }
  emitSessionChanged();
}

export function clearSelfHostedApiSession(): void {
  writeStoredValue(SELF_HOSTED_API_TOKEN_KEY, null);
  writeStoredValue(SELF_HOSTED_API_USER_KEY, null);
  // base URL is intentionally preserved so users do not retype it after logout
  emitSessionChanged();
}

export function useSelfHostedApiSession(): SelfHostedApiSession {
  const [session, setSession] = useState<SelfHostedApiSession>(() => readSelfHostedApiSession());

  useEffect(() => {
    function update() {
      setSession(readSelfHostedApiSession());
    }
    window.addEventListener("storage", update);
    window.addEventListener(SELF_HOSTED_API_SESSION_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(SELF_HOSTED_API_SESSION_EVENT, update);
    };
  }, []);

  return session;
}
