# RDS-3 folder importer for Windows 11

This runbook describes the first safe integration path for the RDS-3 dermatoscope.
It does not install a USB driver and does not talk to the device directly. The
official RDS-3 application captures the photo, and Dermatolog Pro imports the
saved image from the local workstation folder.

## Scope

- Target workstation: Windows 11 with the RDS-3 developer application installed.
- Source folder: `%USERPROFILE%\Documents\Dermatoscopy` by default.
- Backend target: the clinic self-hosted Dermatolog Pro backend.
- Product action: attach the saved dermatoscopy image to an existing visit.

Out of scope for this first step:

- direct IDS/uEye or Hikrobot/MVS SDK capture;
- browser USB/WebUSB/WebSerial access;
- patient delivery;
- medical measurement;
- clinical dynamic conclusion;
- exposing device serials, source file paths, object keys, signed URLs, tokens,
  QR/session values, credentials, or patient text.

## Recommended installer

For a Windows workstation user, use the single setup file:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\DermatologProRdsBridgeSetup.ps1
```

The setup file asks the user to:

1. choose the folder where the RDS-3 application saves photos;
2. enter the Dermatolog Pro address;
3. enter the visit id and optional lesion id;
4. enter the access key.

The access key is saved with Windows current-user encryption
(`ConvertFrom-SecureString`). The installed bridge creates shortcuts for:

- starting `Dermatolog Pro RDS Bridge`;
- reconfiguring the bridge later;
- optional Windows startup launch.

The installer writes files under:

```text
%LOCALAPPDATA%\DermatologPro\RdsBridge
```

The installed worker uses the same safe backend contracts as the Node CLI below.

## Developer command

Run once to import existing saved files:

```powershell
npm run rds3:import-folder -- `
  --watch-dir "%USERPROFILE%\Documents\Dermatoscopy" `
  --api-base-url "http://localhost:3001" `
  --api-token "<self-hosted bearer token>" `
  --visit-id "<visit uuid>" `
  --lesion-id "<lesion uuid>" `
  --mode scan
```

Run continuously while the RDS-3 application is open:

```powershell
npm run rds3:import-folder -- `
  --watch-dir "%USERPROFILE%\Documents\Dermatoscopy" `
  --api-base-url "http://localhost:3001" `
  --api-token "<self-hosted bearer token>" `
  --visit-id "<visit uuid>" `
  --lesion-id "<lesion uuid>" `
  --mode watch
```

The importer keeps a local ledger in the watched folder:

```text
.dermatolog-pro-rds3-import-ledger.json
```

The ledger stores only local import bookkeeping:

- file name;
- sha256 digest as the key;
- imported asset id;
- byte size;
- content type;
- import timestamp.

It does not store source folder paths, object storage paths, signed links, raw
session identifiers, credentials, patient text, or clinical text.

## Import flow

1. The RDS-3 developer application saves a JPEG/PNG/WebP/HEIC file locally.
2. The importer waits until the file stops changing.
3. The importer computes sha256 and skips duplicates already present in the local ledger.
4. The importer calls:

   ```text
   POST /api/v1/visits/{visitId}/assets
   ```

   with `kind=dermoscopy`, `contentType`, `byteSize`, `checksumSha256`,
   `dataBase64`, `originalFileName`, `lesionId`, and `capturedAt`.

5. The backend stores the bytes through backend-owned object storage and returns
   a safe asset DTO.
6. The importer calls:

   ```text
   PATCH /api/v1/visits/{visitId}/assets/{assetId}/capture-metadata
   ```

   with safe technical metadata:

   - `captureSource=device_bridge`;
   - `deviceCaptureProfile=standard_dermoscopy`;
   - `captureProtocolVersion=imported_standard`;
   - `lensProfile=dermoscope_contact`;
   - unknown lighting/focus/calibration values until direct SDK capture is implemented.

## Acceptance criteria

- A real RDS-3 photo saved by the developer application is imported into the
  selected Dermatolog Pro visit.
- Duplicate imports are skipped by sha256.
- The backend response and UI do not expose local source paths, object storage
  paths, signed URLs, tokens, QR/session values, credentials, device serials, or
  patient text.
- Capture metadata remains technical only and does not create diagnosis, risk,
  prognosis, treatment, medical measurement, or dynamic clinical conclusion.
- The doctor can see the imported image in the visit imaging workflow after refresh.

## Verification commands

```bash
npm run test:rds3:import-folder
npm run test:stage4i
```

For live workstation acceptance, use a test visit and a non-production RDS-3
capture first. Keep the official RDS-3 app and Dermatolog Pro backend logs for
the acceptance record, but do not copy patient rows or source paths into the
ticket.

## Next step after this bridge

After the folder importer works with real saved images, implement direct capture
through the detected SDK stack:

- USB vendor `2bdf`: Hikrobot/MVS.
- USB vendor `2caf`: IDS/uEye.

That direct SDK worker should reuse the same backend asset and capture metadata
contracts so the product surface remains stable.
