## Stage 5P — Production patient booking requests intake (operator/clinic)

Логическое продолжение Stage 5O: пациент уже умеет создавать `patient_portal_booking_requests` через `POST /api/v1/me/booking-requests`. Сейчас на стороне клиники (оператор/администратор) нет production-контракта, чтобы видеть эти запросы и переводить их в реальные записи. Stage 5P закрывает эту «вторую половину» — строго в self-hosted PostgreSQL, без managed runtime.

### Цель

- Оператор/администратор в production-режиме видит входящие пациентские запросы на запись и меняет их статус (`reviewing` → `booked`/`cancelled`), при `booked` — связывает с уже существующей `appointment` (создаваемой через Stage 5L `/api/v1/leads/{id}/book-appointment`).
- Demo/dev режим продолжает использовать существующий мок-консоль оператора без изменений.
- Никакого Supabase / `api-read` / `api-write` / Edge Functions / browser hardware / signed URL / storage path / mock-data / external CRM в защищённых runtime-файлах.

### Контракт API (self-hosted)

- `GET  /api/v1/clinic/booking-requests` — список запросов клиники с фильтром по статусу и пагинацией.
- `GET  /api/v1/clinic/booking-requests/{id}` — детали одного запроса (включая связку `patient_user_links`).
- `PATCH /api/v1/clinic/booking-requests/{id}` — смена статуса оператором: `reviewing`, `cancelled`, либо `booked` с обязательным `appointmentId` (FK в `appointments` из Stage 5L).
- `GET  /openapi.stage5p.json` — OpenAPI 3.0.3.

Доступ ограничен ролями `operator`, `clinic_admin`, `system_admin`. Аудит — через существующий `audit-repository.mjs`. Никаких physician-only данных в ответах.

### Данные

Миграция `0019_stage5p_clinic_booking_requests_intake.sql`:

- Колонки в `patient_portal_booking_requests`:
  - `assigned_appointment_id uuid null references appointments(id) on delete set null`
  - `reviewed_by_user_id uuid null references app_users(id) on delete set null`
  - `reviewed_at timestamptz null`
  - `clinic_note text null` (внутренняя пометка, не пациентская)
- Индекс `patient_portal_booking_requests_clinic_status_idx (clinic_id, status, created_at desc)`.
- Триггер `touch_updated_at` уже есть.

### Фронтенд

- Новая страница: `src/pages/operator/OperatorBookingRequestsPageLive.tsx` — production-only, монтируется через `isProductionAppMode()` в существующий operator router. Показывает таблицу: пациент, окно, причина, статус, действия.
- `src/pages/operator/OperatorBookingRequestsPage.tsx` — диспетчер Live vs Demo.
- `src/pages/operator/OperatorBookingRequestsPageDemo.tsx` — мок-данные (исторический формат), demo/dev only.
- В `PRODUCTION_NAV_BY_ROLE.operator` (`AppSidebar.tsx`) добавляется пункт «Запросы на запись» рядом с «Лиды».
- `src/lib/self-hosted-clinic-booking-api.ts` — клиент: `fetchSelfHostedClinicBookingRequests`, `fetchSelfHostedClinicBookingRequest`, `updateSelfHostedClinicBookingRequest`. Без `fetch`/`localStorage` в страницах operator — только через `self-hosted-api-session` и helper.

Production-страницы делают только запросы к `/api/v1/clinic/booking-requests*`. Demo-страница не подключается к сети.

### Backend

- `backend/self-hosted/clinic-booking-requests-repository.mjs` + `*.test.mjs`
- `backend/self-hosted/clinic-booking-requests-service.mjs` + `*.test.mjs` — нормализация payload, события `clinic_booking_requests.list`, `clinic_booking_requests.update`, проверка перехода статусов и FK на `appointments`.
- `routes.mjs` — три эндпоинта + `OPENAPI_5P` + `stage: "5P"`.
- `openapi.stage5p.json`.

### Ограничения / boundary

Защищённые runtime-файлы (guard сканирует):
```
backend/self-hosted/clinic-booking-requests-repository.mjs
backend/self-hosted/clinic-booking-requests-service.mjs
backend/self-hosted/openapi.stage5p.json
src/lib/self-hosted-clinic-booking-api.ts
src/pages/operator/OperatorBookingRequestsPage.tsx
src/pages/operator/OperatorBookingRequestsPageLive.tsx
src/components/shell/AppSidebar.tsx
```
Запрещённые паттерны: `api-read`, `api-write`, `edge function`, `SUPABASE_`, `navigator.usb|bluetooth|serial`, `signed_url`, `storage_object_path`, `mock-data`, `physician_text|physicianText|doctorVersionText`, `crm`, `external notification provider`.

### Скрипты и CI

- `scripts/check-stage5p-production-clinic-booking-requests-intake.mjs` + `*.test.mjs` (паттерн как в 5O).
- `package.json`: `test:stage5p`, `check:stage5p`, `preflight:stage5p`.
- `scripts/preflight-all.mjs`: добавить «Stage 5P production clinic booking requests intake preflight».
- `.github/workflows/stage5p-production-clinic-booking-requests-intake.yml` — копия из 5O.
- `docs/backend/stage-5p-production-clinic-booking-requests-intake.md` — runbook.

### Файлы

```text
NEW backend/self-hosted/db/migrations/0019_stage5p_clinic_booking_requests_intake.sql
NEW backend/self-hosted/clinic-booking-requests-repository.mjs (+ .test.mjs)
NEW backend/self-hosted/clinic-booking-requests-service.mjs (+ .test.mjs)
NEW backend/self-hosted/openapi.stage5p.json
EDIT backend/self-hosted/routes.mjs                  # добавить 3 эндпоинта + OPENAPI_5P
NEW src/lib/self-hosted-clinic-booking-api.ts (+ .test.ts)
NEW src/pages/operator/OperatorBookingRequestsPage.tsx
NEW src/pages/operator/OperatorBookingRequestsPageLive.tsx
NEW src/pages/operator/OperatorBookingRequestsPageDemo.tsx
NEW src/pages/operator/OperatorBookingRequestsPages.production.test.tsx
EDIT src/components/shell/AppSidebar.tsx              # пункт «Запросы на запись» в operator production nav
EDIT src/App.tsx                                      # маршрут /operator/booking-requests
NEW scripts/check-stage5p-production-clinic-booking-requests-intake.mjs (+ .test.mjs)
EDIT scripts/preflight-all.mjs                        # +Stage 5P
EDIT package.json                                     # test/check/preflight:stage5p
NEW .github/workflows/stage5p-production-clinic-booking-requests-intake.yml
NEW docs/backend/stage-5p-production-clinic-booking-requests-intake.md
```

`package-lock.json` не меняется. `deno.lock` не появляется.

### Верификация

```bash
npm run preflight:stage5p
npm run preflight:stage5o
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Ожидаемо: все preflight зелёные, дерево чистое, lock-файл не тронут, граница production сохранена.
