# Stage 4C — Self-hosted auth and RBAC foundation

## 1. Goal

Stage 4C adds the backend security boundary required before any real clinical
write flow:

- local JWT login issued by the self-hosted backend;
- password verification against `app_users.password_hash`;
- RBAC for `GET /api/v1/patients`;
- `GET /api/v1/auth/me` for current user context;
- audit log events for successful login and patient-list reads;
- no managed backend runtime dependency.

The frontend can still use demo auth screens while this backend boundary settles.
The important change is that the backend now has its own auth/RBAC contract.

## 2. Runtime files

- `backend/self-hosted/auth-crypto.mjs` — scrypt password hashing and
  verification.
- `backend/self-hosted/auth-tokens.mjs` — backend-issued HS256 bearer token
  signing and verification.
- `backend/self-hosted/auth-repository.mjs` — reads local users and role
  bindings from PostgreSQL.
- `backend/self-hosted/auth-service.mjs` — login and bearer-token
  authentication.
- `backend/self-hosted/rbac.mjs` — patient-read role enforcement.
- `backend/self-hosted/audit-repository.mjs` — append-only audit writes.
- `backend/self-hosted/openapi.stage4c.json` — Stage 4C API contract.
- `backend/self-hosted/db/migrations/0003_stage4c_auth_seed.sql` — demo local
  login seed.

## 3. Local demo credentials

The local seed updates the Stage 4B demo doctor:

- email: `doctor.demo@example.invalid`
- password: `demo-password`

This is only for local smoke verification. Any real deployment must replace the
seed user and `JWT_SECRET`.

## 4. Protected patient read

`GET /api/v1/patients` now requires a bearer token. Allowed roles:

- `system_admin` — all clinics;
- `clinic_admin` — assigned clinic IDs;
- `doctor` — assigned clinic IDs.

`assistant` and `operator` are intentionally denied until a later workflow
defines their exact permissions.

## 5. API examples

```bash
TOKEN="$(
  curl -s http://localhost:8080/api/v1/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"doctor.demo@example.invalid","password":"demo-password"}' \
  | jq -r .accessToken
)"

curl http://localhost:8080/api/v1/auth/me \
  -H "authorization: Bearer $TOKEN"

curl http://localhost:8080/api/v1/patients \
  -H "authorization: Bearer $TOKEN"
```

## 6. Audit behavior

Stage 4C writes append-only audit events for:

- `auth.login`;
- `patient.list`.

Audit write failures are best-effort and do not break patient reads. A later
stage can tighten this if product requirements demand fail-closed audit
semantics.

## 7. No managed backend runtime dependency

Stage 4C remains self-hosted:

- Node backend process;
- PostgreSQL owned by the operator;
- S3-compatible object storage owned by the operator;
- reverse proxy serving frontend/backend as one product.

The guard rejects managed runtime coupling in Stage 4C backend/deploy files.

## 8. Verification

```bash
npm run test:stage4c
npm run check:stage4c
npm run preflight:stage4c
docker compose --env-file deploy/self-hosted/.env.example -f deploy/self-hosted/docker-compose.stage4a.yml config
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- password hash and token tests pass;
- login and `/api/v1/auth/me` route tests pass;
- patient read requires a valid bearer token and allowed role;
- API errors keep the same safe JSON envelope;
- OpenAPI Stage 4C documents bearer auth and patient-read authorization;
- `package-lock.json` stays untouched.

## 9. Non-goals

- No patient create/update/delete yet.
- No refresh tokens yet.
- No browser integration with the real backend auth flow yet.
- No final production password reset or MFA flow yet.
