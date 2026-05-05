#!/usr/bin/env node
/**
 * Сканер запрещённых паттернов для doctor-контекста.
 *
 * Проверяет, что в src/pages/doctor и src/App.tsx нет:
 *  - запрещённых имён полей (doctorVersionText, patientSafeText, sharedLink,
 *    storagePath, photoRef, modelVersion, heatmapRef, externalUserRef,
 *    protectedAnalysisLink);
 *  - сетевых/браузерных API (fetch(, axios, XMLHttpRequest, sendBeacon,
 *    navigator.clipboard, mediaDevices);
 *  - небезопасных хранилищ (localStorage, sessionStorage);
 *  - недетерминированного времени (Date.now(, new Date()).
 *
 * Тесты исключаются. При находках — выводит отчёт и завершает с кодом 1.
 *
 * Запуск: node scripts/scan-doctor-forbidden.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = ["src/pages/doctor", "src/App.tsx"];

// Токены собираются динамически, чтобы исходник сканера не матчил сам себя.
const j = (...parts) => parts.join("");
const FORBIDDEN = [
  j("doctor", "VersionText"),
  j("patient", "SafeText"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("externalUser", "Ref"),
  j("protectedAnalysis", "Link"),
  j("fetch", "("),
  "axios",
  "XMLHttpRequest",
  j("send", "Beacon"),
  j("navigator", ".", "clipboard"),
  "mediaDevices",
  "localStorage",
  "sessionStorage",
  j("Date", ".", "now", "("),
  j("new ", "Date", "(", ")"),
];

function walk(path, out = []) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
  } else if (
    st.isFile() &&
    /\.(ts|tsx|js|jsx)$/.test(path) &&
    !/\.test\.(ts|tsx)$/.test(path) &&
    !/\.hygiene\.test\./.test(path)
  ) {
    out.push(path);
  }
  return out;
}

const files = TARGETS.flatMap((t) => walk(join(ROOT, t)));
const findings = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const token of FORBIDDEN) {
      if (line.includes(token)) {
        findings.push({ file: relative(ROOT, file), line: i + 1, token, text: line.trim() });
      }
    }
  });
}

const ts = new Date("2026-05-04T00:00:00Z").toISOString();
console.log(`[doctor-hygiene-scan] ${ts}`);
console.log(`[doctor-hygiene-scan] просканировано файлов: ${files.length}`);
console.log(`[doctor-hygiene-scan] запрещённых токенов: ${FORBIDDEN.length}`);

if (findings.length === 0) {
  console.log("[doctor-hygiene-scan] ✓ совпадений не найдено");
  process.exit(0);
}

console.log(`[doctor-hygiene-scan] ✗ найдено совпадений: ${findings.length}`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.token}]  ${f.text}`);
}
process.exit(1);
