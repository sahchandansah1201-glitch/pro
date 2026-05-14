export type AppMode = "demo" | "production";

export const APP_MODE_ENV_KEY = "VITE_APP_MODE";

export function normalizeAppMode(value: unknown): AppMode {
  return String(value ?? "").trim().toLowerCase() === "production"
    ? "production"
    : "demo";
}

export function getAppMode(): AppMode {
  return normalizeAppMode(import.meta.env.VITE_APP_MODE);
}

export function isProductionAppMode(): boolean {
  return getAppMode() === "production";
}

export function isDemoAppMode(): boolean {
  return getAppMode() === "demo";
}
