# Dermatolog Pro · RDS-3 Folder Import · Lovable Verification Prompt

Проверь синхронизацию и отображение source batch `Harden production RDS-3 folder import`.

Работай в режиме **read-only verification**. Не меняй код, Git history, API, installer, migrations или тесты. Не имитируй физический RDS-3 и не называй browser upload доказательством Windows folder import.

## 1. Sync gate

1. Connected repository: `sahchandansah1201-glitch/pro`, branch `main`.
2. В history должен присутствовать source commit `Harden production RDS-3 folder import` либо точный sync commit поверх него.
3. Верни Lovable HEAD, source SHA и `git diff --stat <source-sha> HEAD`.
4. При непустом tree diff останови visual acceptance как `sync mismatch`.

## 2. Source contract

Подтверди наличие без изменения файлов:

1. Node importer записывает `metadata_pending` до PATCH capture metadata.
2. Повтор после сбоя использует сохранённый asset id и не делает второй POST.
3. Ledger и receipt пишутся через temporary file + atomic rename/move.
4. Повреждённый существующий ledger останавливает импорт, а не сбрасывается.
5. Windows worker реализует тот же двухфазный контракт.
6. `last-receipt.json` не содержит filename, watch path, visit/lesion id, token, patient text, storage path или signed URL.
7. `GET /api/v1/visits/:visitId/assets` возвращает только разрешённый `captureSource`.
8. Self-hosted frontend отображает `captureSource=device_bridge` как `Прибор`.
9. Stage 4M содержит шаг `Verify assistant capture and RDS-3 import database journey` с rollback.
10. `e2e:rds3-import:live` является read-only и требует receipt + doctor credentials + test visit id.

## 3. Functional visibility

Проверь рабочий путь роли `doctor` на заранее подготовленной test fixture:

1. `Визиты` → нужный тестовый визит → вкладка `Снимки`.
2. Импортированный asset виден строкой `Дерматоскопия · Прибор`.
3. Действие `Открыть` имеет touch target не меньше 44px.
4. В UI не видны `device_bridge`, `metadata_pending`, checksum, internal UUID, local path, object key, signed URL, token или patient code.
5. Никакие диагноз, риск, прогноз, лечение или измерение из факта импорта не выводятся.

## 4. Обязательная visual matrix

| Route / state | 1280x900 | 390x844 | Overflow | Overlap | Clipped text | Tap targets <44px |
|---|---|---|---:|---:|---:|---:|
| test visit → `Снимки`, строка `Дерматоскопия · Прибор` | PASS/FAIL | PASS/FAIL | count | count | count | count |

Для обеих ширин укажи screenshot/artifact identifier. Если реальная fixture с RDS-3 receipt недоступна, напиши `artifact unavailable` и верни `VISUAL PASS WITH BLOCKERS`; не подменяй её моками.

## Покрытие мозгового штурма

- `SD-MF-015` — **частично решено**: безопасный импорт в выбранный visit/lesion и видимый источник `Прибор` реализованы; реальный Windows/RDS-3 gate ещё обязателен.
- `SD-MF-025` — **частично решено**: импортированный снимок входит в asset pipeline; longitudinal timeline не закрывается этим batch.
- `SD-MF-026` — **частично решено**: asset доступен будущему compare flow; сам compare flow не закрывается этим batch.
- `SD-MF-028` — **частично решено**: источник устройства сохраняется, но идентичность физического дерматоскопа и clinical reliability gate ещё не доказаны.

## Формат ответа

```text
Sync: PASS/FAIL
Lovable HEAD: <sha>
Source commit: <sha> Harden production RDS-3 folder import
Tree parity: PASS/FAIL
Source contract: 10/10 или список gaps
Functional visibility: PASS/FAIL/BLOCKED
Native Russian: PASS/FAIL
Safety/hygiene: PASS/FAIL
Visual matrix: <строка с 1280 и 390 evidence>
Покрытие мозгового штурма: <SD-MF statuses>
Physical RDS-3 evidence: PRESENT/MISSING
Verdict: VISUAL PASS / VISUAL PASS WITH BLOCKERS / VISUAL FAIL
```
