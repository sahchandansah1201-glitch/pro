# Stage 5D — Production mode cutover

Stage 5D makes the browser shell explicitly mode-aware. The product can
still run in demo mode for development and presentation work, but a
production build no longer behaves as a demo-first application.

## 1. Product boundary

- Frontend: Vite/React app shipped with the self-hosted product.
- Backend: `backend/self-hosted` API.
- Database: operator-owned PostgreSQL.
- Object storage: operator-owned self-hosted object storage.
- Worker: operator-owned Device Bridge worker.
- managed runtime: none.
- managed database: none.

## 2. Mode switch

Use `VITE_APP_MODE=production` for production deployments.

```bash
VITE_APP_MODE=production npm run build
```

Any value other than `production` is treated as demo mode. This keeps
existing local tests and demo UX stable while making production opt-in and
explicit.

## 3. Production behavior

In production mode:

- the global demo warning banner is not rendered;
- the demo role switcher is not rendered;
- `/` redirects from the authenticated self-hosted backend role;
- protected workspace routes require a self-hosted API session;
- missing sessions redirect to `/self-hosted/login`;
- route access uses backend-provided roles stored with the self-hosted session;
- denied routes show a production access screen instead of demo role controls.

Demo mode remains available for local product review and training data, but
production routes must be driven by the self-hosted backend session.

## 4. Validation

```bash
npm run preflight:stage5d
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- `test:stage5d` passes app-mode, self-hosted role, `RoleGuard`, and `RoleHome`
  coverage;
- `check:stage5d` confirms the shell cutover markers and package scripts;
- no `deno.lock` files are present;
- `package-lock.json` is unchanged.

## 5. Release note

Stage 5D does not remove demo pages or mock data. It moves demo behavior
behind an explicit mode gate so the same repository can serve both local
demonstration and production self-hosted deployments.
