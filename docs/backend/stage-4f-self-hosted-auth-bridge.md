# Stage 4F — Self-hosted frontend auth bridge

Stage 4F закрывает первый цельный self-hosted workflow для дерматолога:
вход в self-hosted backend, защищённый live-доступ к списку пациентов,
полный CRUD + soft archive через локальный API и docker-compose smoke
для связки frontend + backend + PostgreSQL + object storage.

## 1. Scope

- `src/lib/self-hosted-auth-api.ts` — клиент `POST /api/v1/auth/login` и
  `GET /api/v1/auth/me`.
- `src/lib/self-hosted-api-session.ts` — расширен функциями
  `writeSelfHostedApiSession` / `clearSelfHostedApiSession` и хранением
  пользователя локальной сессии.
- `src/pages/SelfHostedLoginPage.tsx` — публичный маршрут
  `/self-hosted/login` без AppShell.
- `src/App.tsx` — добавлен маршрут `/self-hosted/login`.
- `src/pages/doctor/PatientsPage.tsx` — заголовок страницы получает
  кнопку «Войти в self-hosted backend» (демо) или «Выйти из self-hosted»
  (live). Поведение CRUD не меняется.
- `e2e/self-hosted-stage4f.pw.ts` — Playwright-сценарий
  login → list → create → edit → archive с моками `/api/v1/*`.
- `.github/workflows/stage4f-self-hosted-auth-bridge.yml` — PR-гейт.
- `.github/workflows/stage4f-self-hosted-smoke-nightly.yml` — nightly
  docker-compose smoke (manual + cron).

## 2. UX и сессия

- Публичный маршрут `/self-hosted/login` с формой:
  - адрес backend (по умолчанию `VITE_SELF_HOSTED_API_BASE_URL`),
  - email,
  - пароль.
- При успехе токен и базовый URL сохраняются в `localStorage` под
  существующими ключами `derma-pro:self-hosted-api-base-url` /
  `derma-pro:self-hosted-api-token`. Пользователь — в
  `derma-pro:self-hosted-api-user` (только id, displayName, roles).
- При выходе токен и пользователь очищаются. Базовый URL сохраняется,
  чтобы оператору не пришлось вводить его заново.
- Демо-логин `/login` не меняется. Для перехода между режимами есть
  взаимные ссылки.

## 3. Защищённый live-доступ

`PatientsPage` остаётся на маршруте `/patients` и реагирует на наличие
self-hosted токена:

- Без токена — демо-режим как раньше, кнопка «Войти в self-hosted
  backend» ведёт на `/self-hosted/login`.
- С токеном — live-режим Stage 4D: list/create/update/archive через
  `/api/v1/patients` с заголовком `Authorization: Bearer …`.
- Кнопка «Выйти из self-hosted» очищает сессию и возвращает на
  `/self-hosted/login`.

## 4. E2E smoke

Stage 4F вводит два уровня smoke:

1. **Быстрый mocked Playwright** в обычном PR-гейте:
   `npx playwright test e2e/self-hosted-stage4f.pw.ts`. Все вызовы
   `http://localhost:8080/api/v1/*` перехвачены в браузере, реальный
   backend не нужен.
2. **Nightly docker-compose smoke** (`stage4f-self-hosted-smoke-nightly`):
   запускает `deploy/self-hosted/docker-compose.stage4a.yml`, ждёт
   `/healthz` и `/readyz`, опрашивает `GET /api/v1/patients` без токена
   и убеждается, что backend отвечает `401 auth_required`. Это
   подтверждает live-связку frontend → backend → PostgreSQL без
   managed-runtime зависимостей.

Локально smoke поднимается так:

```bash
cd deploy/self-hosted
cp .env.example .env
docker compose -f docker-compose.stage4a.yml up --build
# в другом терминале
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/readyz
curl -i http://localhost:8080/api/v1/patients   # ожидаем 401 auth_required
```

После smoke остановите стек: `docker compose -f docker-compose.stage4a.yml down -v`.

## 5. Self-hosted boundary

Stage 4F запрещает managed-runtime токены в новых runtime-файлах:

- `supabase`
- `api-read`
- `api-write`
- `edge function`
- `SUPABASE_`

Гард `scripts/check-stage4f-self-hosted-auth-bridge.mjs` проверяет:

- наличие новых файлов (login page, auth client, e2e, workflows, docs);
- отсутствие managed-runtime токенов в self-hosted login и auth-клиенте;
- регистрацию маршрута `/self-hosted/login` в `src/App.tsx`;
- наличие скриптов `test:stage4f`, `check:stage4f`, `preflight:stage4f`
  в `package.json` и шага в `scripts/preflight-all.mjs`.

## 6. Verification

```bash
npm run test:stage4f
npm run check:stage4f
npm run preflight:stage4f
npm run preflight:all -- --dry-run
npm run typecheck
npm run build
```

`npm run preflight:all` включает Stage 4F после Stage 4E.

## 7. Что дальше

Stage 4G должен закрыть самостоятельный self-hosted доктор-workflow
визитов: live-доступ к карточке пациента, визиту, capture pipeline и
полный отчёт без managed runtime.
