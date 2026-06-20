import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const INSTALLER_PATH = "scripts/windows/DermatologProRdsBridgeSetup.ps1";

function installerText() {
  return readFileSync(INSTALLER_PATH, "utf8");
}

test("RDS-3 Windows bridge installer is a human-friendly setup file", () => {
  const text = installerText();
  assert.match(text, /FolderBrowserDialog/);
  assert.match(text, /Выберите папку, куда программа РДС-3 сохраняет снимки/);
  assert.match(text, /Dermatolog Pro RDS Bridge\.lnk/);
  assert.match(text, /Startup/);
  assert.match(text, /Настроить Dermatolog Pro RDS Bridge/);
});

test("RDS-3 Windows bridge installer stores access key through Windows user encryption", () => {
  const text = installerText();
  assert.match(text, /Read-Host "Ключ доступа" -AsSecureString/);
  assert.match(text, /ConvertFrom-SecureString/);
  assert.match(text, /ConvertTo-SecureString \$Cipher/);
  assert.doesNotMatch(text, /token\s*=\s*["'][A-Za-z0-9_-]{16,}["']/i);
});

test("RDS-3 Windows bridge worker uses existing safe asset contracts", () => {
  const text = installerText();
  assert.match(text, /\/api\/v1\/visits\/\$visit\/assets/);
  assert.match(text, /\/capture-metadata/);
  assert.match(text, /kind = "dermoscopy"/);
  assert.match(text, /captureSource = "device_bridge"/);
  assert.match(text, /millimetersAvailable = \$false/);
});

test("RDS-3 Windows bridge ledger avoids source paths and protected output", () => {
  const text = installerText();
  assert.match(text, /fileName = \$safeName/);
  assert.match(text, /assetId = \[string\]\$assetId/);
  assert.match(text, /importedAt =/);
  assert.doesNotMatch(
    text,
    /storagePath|signedUrl|doctorVersionText|patientSafeText|diagnosis|risk|prognosis|treatment|dynamicConclusion/,
  );
});
