# UX Batch 6 · Russian Interface Copy · Lovable Verification Prompt

You are verifying the implementation of `Localize clinical interface copy`.

This is verification-only. Do not implement new features, routes, backend contracts, API calls, database migrations, roles, navigation items, patient delivery, diagnosis/risk/prognosis/treatment copy, medical measurements, or clinical dynamic conclusions.

## Scope to verify

Changed user-facing copy should be limited to:

- `src/pages/SelfHostedLoginPage.tsx`
- `src/lib/self-hosted-auth-api.ts`
- `src/lib/self-hosted-bootstrap-api.ts`
- `src/pages/doctor/VisitWorkspacePage.tsx`
- `src/pages/doctor/VisitWorkspaceLiveBanner.tsx`
- `src/pages/doctor/VisitWorkspaceLiveActions.tsx`
- `src/pages/doctor/VisitImagingTab.tsx`
- `src/pages/doctor/VisitReportTab.tsx`
- `src/pages/doctor/visit-workspace/TimelineQaNavigation.tsx`
- `src/pages/doctor/visit-workspace/visitWorkspaceLabels.ts`
- related tests only

## Routes / screens

Verify desktop 1280px and mobile 390px:

1. `/self-hosted/login`
2. `/patients/:patientId/visits/:visitId?tab=report`
3. `/patients/:patientId/visits/:visitId?tab=imaging`
4. `/patients/:patientId/visits/:visitId?tab=bodymap`

If production mode redirects to the login screen, verify the login screen directly and verify visit tabs in demo/preview data mode.

## Expected Russian copy

Login screen:

- `Дерматолог Pro — рабочий вход`
- `Рабочий режим`
- `Готовность входа`
- `Чек-лист готовности`
- `Сервер клиники доступен`
- `База данных подключена`
- `Хранилище файлов настроено`
- `Первый администратор`
- `Адрес сервера клиники`
- `Эл. почта`
- `Выйти из системы клиники`

Visit workspace/report/imaging/body map:

- `Первичный приём`
- `Карта тела`
- `Снимки визита`
- `Связь с устройством`
- `Источник данных: система клиники`
- `Готовность проверки истории`
- group names: `Данные и запуск`, `Правила и подтверждения`, `Наблюдение и проверка`, `Закрытая проверка`, `Рабочий запуск`
- report tab: `Печать отчёта`, `Подготовка отчёта`, `Отчёт готов к сборке`, `Сборка отчёта заблокирована`, `Задача отчёта подготовлена локально`
- photo block: `Данные фото готовы для системы клиники`, `нужна система клиники для файлов и журнала доступа`
- audit events: `Подготовка`, `Отзыв`, `Открытие фото`, or generic `Событие журнала`

## Forbidden visible UI words

These words must not appear in rendered user-facing text, buttons, headings, status messages, aria-labels, titles, placeholders, or visible table/card labels on the routes above:

- `self-hosted`
- `backend`
- `production`
- `readiness`
- `bootstrap`
- `managed`
- `provider`
- `system_admin`
- `PostgreSQL`
- `Object storage`
- `Stage`
- `SOP`
- `policy`
- `metadata`
- `governance`
- `evidence`
- `rollout`
- `monitoring`
- `validation`
- `workflow`
- `viewer QA`
- `Device Bridge`
- `Body Map`
- `PDF`
- `handoff`
- `Brainstorm`
- `patient-safe`
- `gates`
- `MVP`

Allowed exceptions:

- file formats: `JPEG`, `PNG`, `WebP`, `HEIC`;
- URLs in input placeholders such as `http://localhost:8080`;
- internal code identifiers, test names, DTO keys, API paths, comments, and request payloads are not UI and should not fail this verification unless rendered to users.

## Functional visibility

Confirm:

- `/self-hosted/login` is reachable as the working login screen.
- Doctor visit workspace tabs remain reachable from the visit route.
- Primary actions remain visible and disabled/enabled as before; only copy changed.
- No new routes or navigation entries were added.

## Visual checks

For each route and viewport:

- no horizontal overflow;
- no text overlap or clipped button labels;
- primary action labels are short and readable;
- mobile tap targets remain usable;
- UI looks like part of the existing product, not a new design system.

If visual verification is not performed, report exactly:

```text
visual verification: not performed
reason: <why>
Lovable checklist: <routes and checks still required>
```

Do not claim visual verification is complete unless the rendered UI was inspected.

## Hygiene

Confirm no new:

- patient delivery;
- diagnosis / risk / prognosis / treatment;
- medical measurement values;
- clinical dynamic conclusion;
- tokens / QR / session values / credentials;
- storage paths / signed URLs / raw file references;
- doctor-only text on patient routes.

## Required report format

Return:

```text
Sync:
- connected repo:
- active branch:
- visible HEAD:
- expected commit visible:
- mismatch/reconnect/fallback warning:

Checks:
1. ...
12. ...

Visual verification:
- performed/not performed:
- routes:
- desktop 1280px:
- mobile 390px:
- visual issues:

Hygiene:

Responsive:

Human usability:

Quality metrics:
- forbidden_visible_english_count:
- primary_action_missing_count:
- ambiguous_cta_count:
- visible_internal_id_count:
- protected_field_exposure_count:
- responsive_overflow_count:
- unverified_screen_count:

Покрытие мозгового штурма:
- SD-MF-025 · Хронология снимков очага: в работе / частично решено; this batch improves Russian labels around timeline/workspace only.
- SD-MF-026 · Сравнение снимков: в работе; this batch does not change comparison logic.
- SD-MF-028 · Достоверность анализа динамики: в работе; this batch keeps dynamic/measurement conclusions off.
- SD-MF-046 · Фото и протокол: в работе; this batch improves Russian copy around photo/report delivery boundaries, patient delivery remains off.

Нужна ли дополнительная синхронизация GitHub/Lovable:
```
