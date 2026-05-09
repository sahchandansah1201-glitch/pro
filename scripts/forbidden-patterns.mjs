/**
 * Единый источник правды для запрещённых паттернов в doctor-контексте.
 *
 * Используется:
 *  - scripts/scan-doctor-forbidden.mjs (CI + git-хуки)
 *  - src/pages/doctor/VisitImagingTab.hygiene.test.ts (vitest)
 *
 * Токены собираются динамически через j(...), чтобы сам конфиг
 * не попадал под exact-сканы исходников.
 */

export const j = (...parts) => parts.join("");

/** Запрещённые имена полей/ключей — небезопасны для doctor-контекста. */
export const FORBIDDEN_FIELDS = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
];

/**
 * Запрещённые сетевые/браузерные/storage API и недетерминированное время.
 * Каждый элемент — литеральная подстрока (НЕ regex), чтобы единое
 * представление работало и для includes(), и для теста через regex-escape.
 */
export const FORBIDDEN_APIS = [
  j("fetch", "("),
  j("ax", "ios"),
  j("XML", "Http", "Request"),
  j("send", "Beacon"),
  j("navigator", ".", "clipboard"),
  j("media", "Devices"),
  j("local", "Storage"),
  j("session", "Storage"),
  j("Date", ".", "now", "("),
  j("new ", "Date", "(", ")"),
];

/** Полный список запрещённых токенов (для линейного скана). */
export const FORBIDDEN_TOKENS = [...FORBIDDEN_FIELDS, ...FORBIDDEN_APIS];

/** Цели сканирования по умолчанию. */
export const SCAN_TARGETS = ["src/pages/doctor", "src/App.tsx", "supabase/functions/api-write"];

/** Экранирование подстроки для безопасной вставки в RegExp. */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
