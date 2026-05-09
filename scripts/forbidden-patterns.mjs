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
export const SCAN_TARGETS = ["src/pages/doctor", "src/App.tsx"];

/**
 * Stage 1C api-write hygiene: forbidden tokens that must NEVER appear in
 * the api-write edge function source (server-side controlled).
 */
export const API_WRITE_FORBIDDEN_TOKENS = [
  "service_role",
  "SERVICE_ROLE",
  "SUPABASE_SERVICE_ROLE_KEY",
  j("...row"),
  j("...data"),
  j("...body"),
  j("patient", "Safe", "Text"),
  "console.log",
  // Stage 1D: audit_logs must only be written via the log_clinical_write RPC.
  j('from("audit_', 'logs")'),
  j("from('audit_", "logs')"),
];

export const API_WRITE_SCAN_DIR = "supabase/functions/api-write";

/** Stage 1C + 1D + 1E byte-identity pairs: canonical vs install copy must match.
 *  Name is kept as STAGE1C_* for backward compatibility with existing imports. */
export const STAGE1C_BYTE_IDENTITY_PAIRS = [
  [
    "db/stage1c/migrations/20260507000001_stage1c_writes.sql",
    "supabase/migrations/20260507000001_stage1c_writes.sql",
  ],
  [
    "db/stage1c/tests/stage1c_writes.test.sql",
    "supabase/tests/stage1c_writes.test.sql",
  ],
  [
    "db/stage1d/migrations/20260508000001_stage1d_audit.sql",
    "supabase/migrations/20260508000001_stage1d_audit.sql",
  ],
  [
    "db/stage1d/tests/stage1d_audit.test.sql",
    "supabase/tests/stage1d_audit.test.sql",
  ],
  [
    "db/stage1e/migrations/20260509000001_stage1e_assets.sql",
    "supabase/migrations/20260509000001_stage1e_assets.sql",
  ],
  [
    "db/stage1e/tests/stage1e_assets.test.sql",
    "supabase/tests/stage1e_assets.test.sql",
  ],
];

/** Экранирование подстроки для безопасной вставки в RegExp. */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
