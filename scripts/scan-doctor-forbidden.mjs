#!/usr/bin/env node
/**
 * Сканер запрещённых паттернов для doctor-контекста.
 * Список токенов и цели заданы в scripts/forbidden-patterns.mjs.
 *
 * Режимы:
 *   node scripts/scan-doctor-forbidden.mjs                — полный скан SCAN_TARGETS
 *   node scripts/scan-doctor-forbidden.mjs --staged       — только git staged-файлы
 *   node scripts/scan-doctor-forbidden.mjs --changed