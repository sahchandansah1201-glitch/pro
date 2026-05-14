# Stage 4Q - Self-hosted Device Bridge registry

## 1. Scope

Stage 4Q moves the system devices page from static demo data toward the
self-hosted product boundary:

- PostgreSQL migration for `device_bridges` and `medical_devices`;
- backend `GET /api/v1/device-bridges`;
- backend `GET /api/v1/devices`;
- RBAC scope for `system_admin` and `clinic_admin`;
- audit actions `device_bridge.list` and `device.list`;
- frontend self-hosted adapter for `/sys/devices`;
- OpenAPI contract `/openapi.stage4q.json`;
- guard, workflow, e2e, docs, and `preflight:stage4q`.

## 2. Product Boundary

The browser never talks to hardware drivers directly. Stage 4Q is a registry
surface only:

- frontend calls the self-hosted backend;
- backend reads PostgreSQL-owned registry metadata;
- local Device Bridge remains a separate desktop/server-side component;
- no WebUSB, WebBluetooth, WebSerial, cloud database, edge function, or
  Supabase runtime is introduced.

The target deployable product remains frontend + backend + PostgreSQL + object
storage under the operator's control.

## 3. Backend Contract

Endpoints:

```bash
GET /api/v1/device-bridges
GET /api/v1/devices
```

Access:

- bearer token required;
- `system_admin` can read across clinics;
- `clinic_admin` can read only assigned clinics;
- doctor, assistant, operator, patient roles are denied for `/sys` device
  registry operations.

Safe response fields:

- bridge code, host name, LAN status, version, heartbeat time, paired count;
- device model, serial, firmware, magnification, polarization, calibration
  profile, calibration due date, connection status, last seen time;
- clinic label metadata.

Forbidden in responses:

- driver payloads;
- image bytes;
- object keys and storage paths;
- tokens, cookies, passwords, env values;
- patient names and clinical notes.

## 4. Frontend

`/sys/devices` remains useful without a backend session by showing demo data.
When a self-hosted session exists, it loads:

- `/api/v1/device-bridges`;
- `/api/v1/devices`.

The page keeps the existing dense admin table, filters, pagination, and mobile
cards. The status banner changes from demo to live:

```text
Self-hosted backend подключён. Устройства и Device Bridge читаются из серверного реестра PostgreSQL.
```

## 5. Verification

Focused gate:

```bash
npm run preflight:stage4q
```

Browser coverage:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
npm run e2e:stage4q
```

Stage 4Q is included in:

```bash
npm run preflight:all
```

## 6. CI

`.github/workflows/stage4q-self-hosted-device-registry.yml` runs:

- `npm run preflight:stage4q`;
- `npm run e2e:stage4q`;
- a short GitHub Actions summary describing the self-hosted device boundary.

## 7. Guardrails

`scripts/check-stage4q-self-hosted-device-registry.mjs` verifies:

- required backend, frontend, e2e, docs, workflow, and guard files exist;
- package scripts `test:stage4q`, `check:stage4q`, `preflight:stage4q`,
  and `e2e:stage4q`;
- `preflight-all` includes `Stage 4Q self-hosted device registry preflight`;
- protected runtime files do not reference managed-runtime tokens or browser
  hardware APIs.

Stage 4Q intentionally registers devices; it does not implement live image
streaming or direct dermatoscope control in the browser.
