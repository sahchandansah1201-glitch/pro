# Stage 4A - Self-hosted product architecture guardrail

## 1. Purpose

This document makes the target architecture explicit and checkable: Dermatolog
Pro must become a self-hosted product that can be deployed on the owner's server
as one coherent system. The deliverable is not a frontend that depends on a
managed cloud backend. The deliverable is frontend + backend API + database +
object storage + migrations + logs + backup/restore procedures.

## 2. Target deployment shape

The target deployment is a single product stack controlled by the operator:

- Reverse proxy / TLS termination.
- Static frontend bundle served by the reverse proxy or an app server.
- Backend API process that owns auth, permissions, validation, business logic,
  audit writes, file access, export policies, and integration adapters.
- PostgreSQL-compatible relational database.
- S3-compatible or local object storage for clinical assets, always accessed
  through backend-controlled URLs or backend streaming.
- Migration runner, seed/bootstrap flow, logs, backups, and restore runbooks.

The frontend must be replaceable as a static asset bundle. It must not own
clinical secrets, service-role credentials, direct storage credentials, or
permission decisions.

## 3. Required runtime components

Every production deployment plan must account for these components:

- `frontend`: React/Vite build artifacts.
- `backend-api`: server-side application with request authentication,
  role checks, validation, domain services, audit logging, and error mapping.
- `postgres`: persistent relational database.
- `object-storage`: private storage for medical images and reports.
- `migration-runner`: repeatable schema and data migration execution.
- `backup-restore`: operator-owned database and object-storage backup flow.
- `observability`: logs, correlation ids, health checks, and incident evidence.

Any feature touching real patients, visits, lesions, images, reports, users,
roles, exports, or audit records must route through the backend API.

## 4. Supabase transition rule

Supabase Cloud is not the target architecture. Existing `supabase/` migrations,
Edge Functions, generated types, and frontend Supabase integration are legacy
transition artifacts from the earlier stage.

Allowed:

- Keep legacy Supabase files while the migration path is being built.
- Reuse PostgreSQL-compatible schema ideas.
- Run local checks that prove current behavior is not regressing.

Not allowed without an explicit architecture decision:

- Adding new product behavior that requires Supabase Cloud at runtime.
- Adding service-role or storage credentials to frontend code.
- Treating Edge Functions as the final backend boundary.
- Adding direct browser access to private medical storage.

## 5. Backend ownership rules

The backend owns:

- AuthN/AuthZ and role resolution.
- Patient, visit, lesion, report, asset, user, device, API key, and audit CRUD.
- Server-side validation and patient-safe field projection.
- Asset upload/download policy, signed URL TTL, and storage path generation.
- Audit writes for every sensitive read/write/export.
- Rate limits, pagination limits, export limits, and retry semantics.
- Integration adapters to external systems.

Frontend pages may request actions and render states. They must not decide final
permissions for real data, construct private storage paths, or hold privileged
keys.

## 6. Frontend integration rules

Until the backend API is implemented, UI flows may remain demo/local-only. The
UI must communicate that status clearly and avoid collecting real patient data.

When a flow becomes real:

- The frontend calls the backend API, not a cloud database directly.
- All request/response DTOs are safe for browser visibility.
- Error states are mapped to user-safe messages.
- Tests prove that private tokens, signed URLs, storage paths, emails, full
  patient names, and raw env values are not printed in visible UI or logs.

## 7. Verification commands

Run these before accepting backend/frontend architecture work:

```bash
npm run check:self-hosted-product
npm run test:self-hosted-product
npm run preflight:all -- --summary test-results/preflight-all.md
```

The first command checks the repository contract for self-hosted product
direction. The second covers the checker itself. The third includes the
self-hosted guard in the full deterministic preflight.

## 8. Lovable and Codex working rule

Codex may implement code directly and publish it through GitHub PRs. Lovable
may sync and apply those changes. Both tools must preserve this architecture
direction:

- If a suggestion improves demo UX but does not move the backend boundary, it
  can be accepted as frontend-only.
- If a suggestion asks for real patient persistence, auth, deletion, audit, or
  storage while still relying on frontend/local state, it must be deferred or
  converted into backend API work.
- If a suggestion introduces a cloud-only dependency, it must be explicitly
  triaged as an architecture decision before implementation.

## 9. Acceptance criteria

This stage is protected when:

- `PRODUCT.md` states the self-hosted product goal.
- This document lists the deployable runtime components.
- `npm run check:self-hosted-product` is green locally and in CI.
- `npm run preflight:all` includes the self-hosted guard.
- New PRs do not introduce frontend service-role credentials or direct private
  storage access.
