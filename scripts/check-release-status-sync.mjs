#!/usr/bin/env node
// Stage 3M · Guard release-status UI/docs/CI sync points.

import { existsSync, readFileSync } from "node:fs";

const REQUIRED_FILES = [
  "src/lib/release-status-ui.ts",
  "src/lib/release-status-ui.test.ts",
  "src/pages/sys/SysReleaseStatusPage.tsx",
  "src/pages/sys/SysReleaseStatusPage.test.tsx",
  "e2e/sys-release-status.pw.ts",
  "scripts/preflight-release-status.mjs",
  "scripts/check-stage3-docs.mjs",
  "docs/frontend/stage-3m-release-operations-dashboard.md",
  "docs/frontend/stage-3i-final-documentation-index.md",
  ".github/workflows/release-status.yml",
  "package.json",
];

const REQUIRED_TEXT = {
  "src/lib/release-status-ui.ts": [
    "DEFAULT_RELEASE_HISTORY_FILTER_PRESETS",
    "RELEASE_HISTORY_FILTER_PRESET_LIMIT",
    "buildReleaseHistoryFilterPreset",
    "normalizeReleaseHistoryFilterPreset",
    "buildFilteredReleaseHistoryXlsxBytes",
    "releaseHistoryFilteredXlsxFilename",
  ],
  "src/lib/release-status-ui.test.ts": [
    "normalizes saved release-history filter presets safely",
    "buildFilteredReleaseHistoryXlsxBytes",
    "releaseHistoryFilteredXlsxFilename",
  ],
  "src/pages/sys/SysReleaseStatusPage.tsx": [
    "Пресет фильтров release history",
    "Сводка пресетов release history",
    "Сохранить текущие фильтры release history как пресет",
    "Удалить сохранённый пресет release history",
    "Экспортировать отфильтрованную release history в XLSX",
    "Подсказки исправления release history",
    "Фокус на JSONL с ошибкой",
  ],
  "src/pages/sys/SysReleaseStatusPage.test.tsx": [
    "applies, saves, persists, and deletes release-history filter presets",
    "Экспортировать отфильтрованную release history в XLSX",
    "Фокус на JSONL с ошибкой",
  ],
  "e2e/sys-release-status.pw.ts": [
    "Пресет фильтров release history",
    "release-history-filtered-",
    ".xlsx",
    "Фокус на JSONL с ошибкой",
  ],
  "scripts/preflight-release-status.mjs": [
    "release status sync checker",
    "check:release-status-sync",
  ],
  "scripts/check-stage3-docs.mjs": [
    "check-release-status-sync.mjs",
    "history-filter-presets",
    "filtered-history-xlsx",
    "import-error-actions",
  ],
  "docs/frontend/stage-3m-release-operations-dashboard.md": [
    "history-filter-presets",
    "filtered-history-xlsx",
    "import-error-actions",
    "release-status-sync-checker",
    "npm run check:release-status-sync",
  ],
  "docs/frontend/stage-3i-final-documentation-index.md": [
    "npm run check:release-status-sync",
    "PR #65",
  ],
  ".github/workflows/release-status.yml": [
    "scripts/check-release-status-sync.mjs",
    "src/lib/release-status-ui.ts",
    "src/pages/sys/SysReleaseStatusPage.tsx",
    "e2e/sys-release-status.pw.ts",
    "npm run check:release-status-sync",
  ],
  "package.json": ['"check:release-status-sync"'],
};

const errors = [];

function read(path) {
  if (!existsSync(path)) {
    errors.push(`Missing file: ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

for (const path of REQUIRED_FILES) {
  read(path);
}

for (const [path, requiredTexts] of Object.entries(REQUIRED_TEXT)) {
  const content = read(path);
  for (const text of requiredTexts) {
    if (!content.includes(text)) {
      errors.push(`${path} missing required text: ${text}`);
    }
  }
}

if (errors.length > 0) {
  console.error("[check-release-status-sync] FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[check-release-status-sync] OK");
