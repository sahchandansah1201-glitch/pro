#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, isAbsolute, resolve } from "node:path";
import { execSync } from "node:child_process";
import { FORBIDDEN_TOKENS, SCAN_TARGETS } from "./forbidden-patterns.mjs";

/**
 * Сканер запрещённых паттернов для doctor-контекста.
 *
 * Режимы:
 *   (по умолчанию)   — полный скан SCAN_TARGETS, пишет отчёты в reports/
 *   --staged         — только git staged-файлы (pre-commit)
 *   --changed        — staged + изменённые в рабочей копии (pre-push)
 *   path1 path2 ...  — явный список путей
 *
 * Файлы вне SCAN_TARGETS, тесты (*.test.