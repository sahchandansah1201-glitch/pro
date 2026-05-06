# Stage 1A — Backend Setup Runbook

Этот документ описывает только **scaffolding-этап** перед Stage 1A.
Никаких таблиц, RLS, миграций и seed-данных на этом этапе не создаётся.

## 1. Требования

- Установлен Docker Desktop (или Docker Engine + Compose) и запущен.
- Установлен Node.js 18+.
- Установлен Supabase CLI:
  ```bash
  npm i -g supabase
  # или
  brew install supabase/tap/supabase
  ```
- Linked external Supabase project:
  - **Project ref:** `exayfgindfbupzpnjzfl`
  - **Project name:** `DermatologyPro`

## 2. Команды (локально)

```bash
# Установка зависимостей CLI (один раз)
supabase --version

# Линковка к удалённому проекту (один раз)
supabase link --project-ref exayfgindfbupzpnjzfl

# Локальный стек (Docker должен быть запущен)
npm run db:start     # supabase start
npm run db:status    # supabase status
npm run db:reset     # supabase db reset  (полный сброс локальной БД)
npm run db:stop      # supabase stop
```

## 3. Локальные URL

После `supabase start`:

| Сервис          | URL                              |
|-----------------|----------------------------------|
| API             | http://127.0.0.1:54321           |
| Studio          | http://127.0.0.1:54323           |
| Mailpit (SMTP)  | http://127.0.0.1:54324           |
| MCP             | http://127.0.0.1:54321/mcp       |
| Postgres        | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## 4. Что МОЖНО коммитить

- `supabase/config.toml`
- `supabase/migrations/**` (когда появятся, не сейчас)
- `supabase/seed.sql` (когда появится, не сейчас)
- `.env.example` (только плейсхолдеры)
- этот runbook
- npm-скрипты в `package.json`

## 5. Что НИКОГДА не коммитить

- `.env`, `.env.local`, `.env.*.local`
- `supabase/.temp/**`
- `supabase/.branches/**`
- любые `*service_role*`, access tokens, DB URL с паролем
- дампы БД с реальными данными
- логи Docker

## 6. Чек-лист готовности к Stage 1A

- [ ] Docker запущен
- [ ] `supabase --version` ≥ актуальной CLI
- [ ] `supabase link --project-ref exayfgindfbupzpnjzfl` выполнен
- [ ] `npm run db:start` поднимает стек без ошибок
- [ ] `npm run db:status` показывает все сервисы Running
- [ ] Studio открывается на `http://127.0.0.1:54323`
- [ ] Mailpit открывается на `http://127.0.0.1:54324`
- [ ] `.env` создан локально из `.env.example` и **не** в Git
- [ ] `supabase/.temp` игнорируется Git
- [ ] В `src/**` нет изменений на этом этапе
- [ ] В репозитории нет секретов (grep по `service_role`, `eyJ`, реальным URL)

## 7. Rollback (только для setup-изменений)

Если нужно откатить scaffolding:

```bash
# Остановить локальный стек
npm run db:stop

# Удалить созданные scaffolding-файлы (вручную через git)
#   - .env.example
#   - docs/backend/stage-1a-runbook.md
#   - npm-скрипты db:* в package.json
#   - правки .gitignore (если были)

# Локальные данные Docker-volume Supabase
supabase stop --no-backup
```

Никаких миграций/таблиц/политик на этом этапе не создавалось,
поэтому откат scaffolding не затрагивает удалённый проект
`exayfgindfbupzpnjzfl`.
