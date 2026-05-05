# Дерматолог Про

Платформа клинической поддержки решений для дерматологов и дермато-онкологов.

---

## Doctor-hygiene scan

Автоматический сканер запрещённых паттернов защищает doctor-контекст от регрессий по безопасности данных, сетевым вызовам и недетерминированному времени.

### Что сканируется

- `src/pages/doctor/**` — страницы и логика рабочего места врача.
- `src/App.tsx` — корневой роутинг.

Тестовые файлы (`*.test.ts(x)`, `*.hygiene.test.*`) исключаются автоматически.

### Где живут правила

Единый источник правды — [`scripts/forbidden-patterns.mjs`](./scripts/forbidden-patterns.mjs). Один и тот же список используют:

- скрипт сканирования `scripts/scan-doctor-forbidden.mjs`;
- git-хуки `.husky/pre-commit` и `.husky/pre-push`;
- workflow `.github/workflows/doctor-hygiene-scan.yml` (push, PR, ежедневное расписание, ручной запуск);
- vitest-тест `src/pages/doctor/VisitImagingTab.hygiene.test.ts`.

### Запрещённые имена полей и ключей

Прямые ссылки на чувствительные доменные контракты запрещены — их следует читать через accessor-слой [`src/lib/report-access.ts`](./src/lib/report-access.ts):

| Паттерн | Чем заменить |
| --- | --- |
| `doctorVersionText` | accessor `getReportInternalText(report)` |
| `patientSafeText` | accessor `getReportSafeText(report)` |
| `sharedLink` | accessors `getReportLinkExpiry` / `getReportLinkToken` |
| `storagePath` | локальный мок-ключ (например, `localFileKey`) |
| `photoRef` | доменные id фото из `mock-data` |
| `modelVersion` | не пробрасывать в UI |
| `heatmapRef` | accessor (когда появится), не строковый ключ |
| `externalUserRef` | использовать только в operator/admin контексте |
| `protectedAnalysisLink` | accessor `getReportLinkToken` |

### Запрещённые API и недетерминизм

| Паттерн | Почему запрещён | Чем заменить |
| --- | --- | --- |
| `fetch(`, `axios`, `XMLHttpRequest`, `sendBeacon` | doctor-страницы работают на mock-данных, без сети | импорт из `src/lib/mock-data` |
| `navigator.clipboard`, `mediaDevices` | браузерные device API не нужны на doctor-страницах | вызов остаётся в Capture/Operator слое |
| `localStorage`, `sessionStorage` | хранение состояния doctor-данных в браузере небезопасно | состояние в React, демо — статичные моки |
| `Date.now(`, `new Date()` | недетерминированное время ломает снапшоты и демо | константа `BODY_MAP_DEMO_NOW` из `src/pages/doctor/body-map-model.ts` |

### Локальный запуск

```bash
# Один прогон сканера + JSON/MD-отчёт в reports/doctor-hygiene/
npm run scan:doctor

# Прогон hygiene-теста
npx vitest run src/pages/doctor/VisitImagingTab.hygiene.test.ts
```

Сканер выводит структурированный отчёт (файл, строка, токен, контекст) и завершается с кодом `1` при находках. Тот же отчёт сохраняется в:

- `reports/doctor-hygiene/scan-report.json` — машиночитаемый,
- `reports/doctor-hygiene/scan-report.md` — для людей.

### Git-хуки

Хуки активируются автоматически после `npm install` (через `husky`):

- `pre-commit` — блокирует коммит при находках;
- `pre-push` — повторный прогон перед отправкой в remote.

Обход (`git commit --no-verify`) допустим только при сознательном решении и должен сопровождаться объяснением в PR.

### Как исправить нарушение

1. Запустите `npm run scan:doctor` и откройте `reports/doctor-hygiene/scan-report.md`.
2. Для **полей-ключей** — используйте accessor из `src/lib/report-access.ts` (или добавьте новый там же, не в `src/pages/doctor/**`).
3. Для **сетевых/storage API** — перенесите вызов из doctor-слоя или замените мок-данными.
4. Для **`Date.now()` / `new Date()`** — используйте `BODY_MAP_DEMO_NOW` (`"2026-05-04T00:00:00Z"`) или `DEMO_NOW_ISO` из `src/lib/report-access.ts`.
5. Перезапустите `npm run scan:doctor` — отчёт должен показать `clean`.

### Расширение списка

Если нужно добавить новый запрещённый паттерн — правьте только [`scripts/forbidden-patterns.mjs`](./scripts/forbidden-patterns.mjs). Все остальные потребители (CI, хуки, vitest-тест) подхватят его автоматически.
