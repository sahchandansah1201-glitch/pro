# Stage 4R — Self-hosted Device Bridge commands

Stage 4R adds a backend-owned command boundary for Device Bridge actions. The
browser can request safe commands, but it still never talks to dermatoscope
drivers, USB, Bluetooth, serial ports, or local hardware APIs directly.

## Scope

- Add PostgreSQL table `device_bridge_commands`.
- Add backend endpoints:
  - `POST /api/v1/device-bridges/{bridgeId}/commands`
  - `POST /api/v1/devices/{deviceId}/commands`
- Add command types:
  - `bridge_health_check`
  - `device_calibration_request`
  - `device_stream_open_request`
- Add RBAC scope `deviceCommandScope`.
- Add audit events:
  - `device_bridge.command.create`
  - `device.calibration.request`
  - `device.stream.request`
- Wire `/sys/devices` live buttons to backend commands.

## Product Boundary

The deployable product remains self-hosted:

- Frontend: browser UI.
- Backend: Node self-hosted API.
- Database: PostgreSQL owned by the deployment.
- Object storage: backend-owned self-hosted storage.
- Device Bridge: local worker/desktop/server-side component that can consume
  queued commands later.

There is no new Supabase runtime dependency, no managed cloud database
contract, and no browser-side hardware access.

## Runtime Behavior

- `system_admin` can queue commands globally.
- `clinic_admin` can queue commands only inside their clinic scope.
- `doctor`, `assistant`, and `operator` are denied for system Device Bridge
  commands.
- Commands return `202 Accepted` and `status: queued`.
- The response exposes command IDs and safe registry metadata only.
- Raw driver payloads, tokens, storage paths, patient names, and hardware
  handles are not returned.

## Frontend Behavior

When a self-hosted session is present, `/sys/devices` sends:

- `bridge_health_check` from "Проверить мост".
- `device_calibration_request` from "Запросить калибровку".
- `device_stream_open_request` from "Открыть поток".

Without a self-hosted token, the page stays in demo mode and shows local status
messages only.

## Verification

```bash
npm run preflight:stage4r
npm run e2e:stage4r
node scripts/check-no-deno-locks.mjs
```

`npm run preflight:stage4r` runs backend service/repository/route tests,
frontend API and page tests, the Stage 4R guard, and the deno-lock guard.

## Guardrails

`scripts/check-stage4r-device-bridge-commands.mjs` enforces:

- required migration, backend, frontend, docs, workflow, and e2e files;
- OpenAPI 4R and nginx proxy exposure;
- package scripts and `preflight-all` wiring;
- no `supabase`, `api-read`, `api-write`, edge function, `SUPABASE_*`;
- no `navigator.usb`, `navigator.bluetooth`, or `navigator.serial`.
