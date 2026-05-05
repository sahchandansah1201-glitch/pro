#!/usr/bin/env node
// Сканер запрещённых паттернов для doctor-контекста.
// Список токенов и цели — в scripts/forbidden-patterns.mjs.
//
// Режимы:
//   (по умолчанию)   — полный скан SCAN_TARGETS, пишет отчёты в reports/
//   --staged         — только git staged-файлы (pre-commit)
//   --changed        — staged + изменённые в рабочей копии (pre-push)
//   path1 path2 ...  — явный список путей
//
// Файлы вне SCAN_TARGETS, тесты (*.test