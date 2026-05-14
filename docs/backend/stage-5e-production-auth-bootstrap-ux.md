# Stage 5E — Production Auth & Role Bootstrap UX

Stage 5E makes `/self-hosted/login` the production entry point for the
self-hosted product. Stage 5D removed demo shell controls from production mode;
Stage 5E gives operators a clear first-login and bootstrap-readiness workflow.

## 1. Product boundary

- Frontend: Vite/React app in `VITE_APP_MODE=production`.
- Backend: `backend/self-hosted` API.
- Database: operator-owned PostgreSQL.
- Object storage: operator-owned self-hosted object storage.
- Worker: operator-owned Device Bridge worker.
- managed runtime: none.
- managed database: none.

## 2. Login behavior

Production login uses the local backend only:

- `POST /api/v1/auth/login` for credentials;
- stored token is scoped to the current browser and self-hosted API base URL;
- successful production login redirects to `/`, where Stage 5D routes by
  backend-provided roles;
- demo login link is hidden when `VITE_APP_MODE=production`.

## 3. Bootstrap readiness UX

The login page now includes a production bootstrap panel. It checks public,
credential-free backend endpoints:

- `/healthz`;
- `/readyz`;
- `/api/v1/meta`.

The panel summarizes:

- backend reachability;
- PostgreSQL readiness;
- object storage configuration;
- local JWT auth configuration;
- first `system_admin` bootstrap status.

The first `system_admin` remains an operator-owned server action. Generate it
through Stage 5B:

```bash
node scripts/stage5b-server-bootstrap.mjs admin-sql \
  --email admin@example.com \
  --display-name "System Administrator" \
  --password "<temporary-password>" \
  --output /secure/path/bootstrap-system-admin.sql
```

Then Stage 5C pre-start SQL verifies that production has no demo credentials
and at least one `system_admin` exists.

## 4. Validation

```bash
npm run preflight:stage5e
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- login tests cover production redirect through `/`;
- bootstrap client tests prove readiness checks do not send auth headers;
- guard confirms package scripts, docs, workflow, and self-hosted boundary;
- no `deno.lock` files are present;
- `package-lock.json` is unchanged.

## 5. Release note

Stage 5E does not create users in the browser. It intentionally keeps first
administrator creation on the server through Stage 5B SQL so production
bootstrap remains operator-owned and independent of external identity services.
