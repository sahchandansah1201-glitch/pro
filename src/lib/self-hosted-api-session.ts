import { useEffect, useState } from "react";

export const SELF_HOSTED_API_BASE_URL_KEY = "derma-pro:self-hosted-api-base-url";
export const SELF_HOSTED_API_TOKEN_KEY = "derma-pro:self-hosted-api-token";

export interface SelfHostedApiSession {
  apiBaseUrl: string;
  apiToken: string | null;
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

export function readSelfHostedApiSession(): SelfHostedApiSession {
  const apiBaseUrl = (readStoredValue(SELF_HOSTED_API_BASE_URL_KEY) ?? envBaseUrl()).replace(/\/+$/, "");
  const apiToken = readStoredValue(SELF_HOSTED_API_TOKEN_KEY);
  return {
    apiBaseUrl,
    apiToken,
    status: apiToken ? "configured" : "missing_token",
  };
}

export function isSelfHostedApiConfigured(session: SelfHostedApiSession): boolean {
  return session.status === "configured" && Boolean(session.apiToken);
}

export function useSelfHostedApiSession(): SelfHostedApiSession {
  const [session, setSession] = useState<SelfHostedApiSession>(() => readSelfHostedApiSession());

  useEffect(() => {
    function update() {
      setSession(readSelfHostedApiSession());
    }
    window.addEventListener("storage", update);
    window.addEventListener("derma-pro:self-hosted-api-session", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("derma-pro:self-hosted-api-session", update);
    };
  }, []);

  return session;
}
