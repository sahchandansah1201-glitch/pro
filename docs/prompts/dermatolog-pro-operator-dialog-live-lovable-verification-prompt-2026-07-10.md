# Dermatolog Pro · Operator Dialog Live Path · Lovable Verification Prompt

Проверь синхронизацию и отображение source batch `Close production operator dialog path`.

Работай в режиме **read-only verification**: не меняй код, Git history, migrations, API contracts или тесты. Не создавай новый дизайн поверх source. Если commit ещё не появился в Lovable, остановись и верни sync mismatch.

## 1. Sync gate

1. Connected repository: `sahchandansah1201-glitch/pro`, branch `main`, либо точный Lovable mirror этой ветки.
2. В visible history должен присутствовать commit с темой `Close production operator dialog path` либо технический sync commit непосредственно поверх него.
3. Укажи Lovable HEAD, source commit SHA и результат `git diff --stat <source-sha> HEAD`.
4. Если source commit отсутствует или tree diff не пуст, не продолжай visual acceptance.

## 2. Functional visibility

Проверь production-mode путь роли `operator`:

1. В sidebar виден пункт `Запросы на запись`.
2. На `/operator/booking-requests` каждая видимая заявка имеет действие `Карточка`.
3. Действие открывает `/operator/dialogs/:id`.
4. На странице видны:
   - заголовок `Карточка обращения`;
   - пациент без внутреннего кода;
   - предпочтительное время;
   - клиника;
   - причина обращения;
   - поле `Заметка клиники`;
   - команда `Сохранить заметку`;
   - возврат `К запросам`;
   - понятный статус `Новая`, `В работе`, `Записана` или `Отменена`.
5. Пустая заметка показывает `Введите заметку клиники.`.
6. После успешного сохранения виден результат `Заметка сохранена. Обращение взято в работу.`.
7. В системном аудите action `clinic_booking_request.update` отображается как `Заметка обращения сохранена`, entity — `обращения на запись`.

## 3. Native Russian and safety

- Экран должен выглядеть как нативный русский рабочий интерфейс оператора, а не перевод технической панели.
- Не должны быть видны internal UUID, patient code, raw messenger identifiers, backend/self-hosted/PostgreSQL wording, storage path, signed URL, access/session/QR token или credential.
- Текст должен явно сообщать, что заметка доступна сотрудникам клиники и не отправляется пациенту.
- Не добавляй диагноз, прогноз, риск, лечение, измерение или автоматическое клиническое заключение.

## 4. Обязательная visual matrix

Верни отдельную строку для каждого viewport. Недостаточно написать только `responsive clean`.

| Route / state | 1280x900 | 390x844 | Overflow | Overlap | Clipped text | Tap targets <44px |
|---|---|---|---:|---:|---:|---:|
| `/operator/booking-requests`, заявка с действием `Карточка` | PASS/FAIL | PASS/FAIL | count | count | count | count |
| `/operator/dialogs/:id`, новая заявка | PASS/FAIL | PASS/FAIL | count | count | count | count |
| `/operator/dialogs/:id`, сохранённая заметка / `В работе` | PASS/FAIL | PASS/FAIL | count | count | count | count |
| `/sys/audit`, найдено `Заметка обращения сохранена` | PASS/FAIL | PASS/FAIL | count | count | count | count |

Для каждой строки укажи screenshot/artifact identifier или честно напиши `artifact unavailable`. Не называй visual verification полной, если 1280 и 390 не были реально отрисованы.

## 5. Source contract checks

Подтверди наличие:

1. `OperatorDialogPageLive.tsx` и production/demo switch в `OperatorDialogPage.tsx`.
2. Link из `OperatorBookingRequestsPageLive.tsx` на `/operator/dialogs/:id`.
3. GET/PATCH через existing clinic booking-request API.
4. Stage 4M smoke `stage4m-operator-dialog-db-smoke.mjs` с clinic scope и rollback.
5. Stage 4M deploy step `Verify operator dialog database journey`.
6. Live E2E desktop/mobile screenshots для dialog и проверка persistence после reload.
7. Live E2E проверяет видимое audit event после повторного входа system admin.

## Покрытие мозгового штурма

- `SD-MF-025` — **решено для browser operator path, в работе для RDS-3**: карточка обращения не меняет capture/import workflow.
- `SD-MF-026` — **частично решено**: реальный operator dialog, persistence и audit подготовлены; production deployed-HEAD gate и RDS-3 evidence остаются.
- `SD-MF-028` — **в работе**: клинические выводы не включены.
- `SD-MF-046` — **в работе**: patient photo/file delivery остаётся отключённой.

## Формат ответа

```text
Sync: PASS/FAIL
Lovable HEAD: <sha>
Source commit: <sha> Close production operator dialog path
Tree parity: PASS/FAIL
Functional visibility: PASS/FAIL
Native Russian: PASS/FAIL
Safety/hygiene: PASS/FAIL
Visual matrix:
<4 строки matrix с 1280 и 390 evidence>
Source contract: 7/7 или список gaps
Покрытие мозгового штурма: <статусы SD-MF>
Verdict: VISUAL PASS / VISUAL PASS WITH BLOCKERS / VISUAL FAIL
Нужна дополнительная синхронизация: да/нет
```
