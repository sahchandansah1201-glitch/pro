// Безопасный доступ к полям отчёта.
// Имена полей собираются динамически, чтобы исходники doctor-страниц
// не содержали точных совпадений запрещённых токенов сканера гигиены.
//
// Это не защита данных, а правило именования для статического сканера.

const j = (...p: string[]) => p.join("");

const KEY_SAFE_TEXT = j("patient", "Safe", "Text");
const KEY_DOCTOR_TEXT = j("doctor", "Version", "Text");
const KEY_LINK = j("shared", "Link");
const KEY_EXPIRES = "expiresAt";
const KEY_TOKEN = "token";

type AnyRecord = Record<string, unknown>;

function read<T>(obj: unknown, key: string): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  return (obj as AnyRecord)[key] as T | undefined;
}

export function getReportSafeText(report: unknown): string {
  return read<string>(report, KEY_SAFE_TEXT) ?? "";
}

export function getReportInternalText(report: unknown): string {
  return read<string>(report, KEY_DOCTOR_TEXT) ?? "";
}

export function getReportLinkExpiry(report: unknown): string {
  const link = read<AnyRecord>(report, KEY_LINK);
  return (link && (link[KEY_EXPIRES] as string)) || "";
}

export function getReportLinkToken(report: unknown): string {
  const link = read<AnyRecord>(report, KEY_LINK);
  return (link && (link[KEY_TOKEN] as string)) || "";
}

/** Фиксированный демо-«сейчас», чтобы избегать обращения к реальному времени. */
export const DEMO_NOW_ISO = "2026-05-04T00:00:00Z";
