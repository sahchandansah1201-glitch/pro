import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const INSTALLER_PATH = "scripts/windows/DermatologProRdsBridgeSetup.ps1";

function installerText() {
  return readFileSync(INSTALLER_PATH, "utf8");
}

test("RDS-3 Windows bridge installer uses a UTF-8 BOM for Windows PowerShell 5.1", () => {
  const bytes = readFileSync(INSTALLER_PATH);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test("RDS-3 Windows bridge installer is a human-friendly setup file", () => {
  const text = installerText();
  assert.match(text, /FolderBrowserDialog/);
  assert.match(text, /Выберите папку, куда программа РДС-3 сохраняет снимки/);
  assert.match(text, /Dermatolog Pro RDS Bridge\.lnk/);
  assert.match(text, /Startup/);
  assert.match(text, /Настроить Dermatolog Pro RDS Bridge/);
  assert.match(text, /DefaultValue "https:\/\/pro\.skindoktor\.ru"/);
});

test("RDS-3 Windows bridge installer selects an assistant-visible visit without asking for an internal UUID", () => {
  const text = installerText();
  assert.match(text, /Choose-Visit/);
  assert.match(text, /DropDownList/);
  assert.match(text, /\/api\/v1\/visits\?limit=50/);
  assert.match(text, /patient\.fullName/);
  assert.match(text, /Повторить ввод/);
  assert.match(text, /Установка отменена пользователем/);
  assert.doesNotMatch(text, /Prompt "Номер визита в системе"/);
  assert.doesNotMatch(text, /Prompt "Номер очага/);
  assert.doesNotMatch(text, /Ask-RequiredUuid/);
  assert.doesNotMatch(text, /throw "Поле '\$FieldName' обязательно/);
});

test("RDS-3 Windows bridge installer stores assistant credentials through Windows user encryption", () => {
  const text = installerText();
  assert.match(text, /Рабочая почта ассистента/);
  assert.match(text, /Read-Host "Пароль ассистента" -AsSecureString/);
  assert.match(text, /ConvertFrom-SecureString/);
  assert.match(text, /ConvertTo-SecureString \$Cipher/);
  assert.match(text, /emailCipher = \$emailCipher/);
  assert.match(text, /passwordCipher = \$passwordCipher/);
  assert.doesNotMatch(text, /tokenCipher =/);
  assert.doesNotMatch(text, /Read-Host "Ключ доступа"/);
  assert.doesNotMatch(text, /token\s*=\s*["'][A-Za-z0-9_-]{16,}["']/i);
});

test("RDS-3 Windows bridge worker logs in and renews short-lived bearer tokens", () => {
  const text = installerText();
  assert.match(text, /\/api\/v1\/auth\/login/);
  assert.match(text, /accessToken/);
  assert.match(text, /expiresInSeconds/);
  assert.match(text, /Get-BridgeSession/);
  assert.match(text, /expiresAt/);
  assert.match(text, /Test-BridgeAccess/);
  assert.match(text, /\/api\/v1\/visits\/\$visit/);
  assert.match(text, /role -eq "assistant"/);
  assert.doesNotMatch(text, /Get-PlainToken -Cipher \(\[string\]\$config\.tokenCipher\)/);
});

test("RDS-3 Windows bridge backs off after authentication or network failures", () => {
  const text = installerText();
  assert.match(text, /retrySeconds = 15/);
  assert.match(text, /Start-Sleep -Seconds \(\[int\]\$config\.retrySeconds\)/);
});

test("RDS-3 Windows bridge redacts local credentials and transient tokens", () => {
  const text = installerText();
  assert.match(text, /\[почта скрыта\]/);
  assert.match(text, /\[пароль скрыт\]/);
  assert.match(text, /\[ключ скрыт\]/);
  assert.match(text, /Hide-SensitiveText[\s\S]+PlainEmail[\s\S]+PlainPassword[\s\S]+PlainToken/);
  assert.doesNotMatch(text, /Write-BridgeLog[^\n]*(PlainEmail|PlainPassword|accessToken)/);
});

test("RDS-3 Windows bridge worker uses existing safe asset contracts", () => {
  const text = installerText();
  assert.match(text, /\/api\/v1\/visits\/\$visit\/assets/);
  assert.match(text, /\/capture-metadata/);
  assert.match(text, /kind = "dermoscopy"/);
  assert.match(text, /captureSource = "device_bridge"/);
  assert.match(text, /metadata_pending/);
  assert.match(text, /last-receipt\.json/);
  assert.match(text, /Save-Ledger[\s\S]+capture-metadata/);
  assert.match(text, /schemaVersion = 1/);
  assert.match(text, /Журнал импорта повреждён/);
  assert.match(text, /\$null -eq \$ledger\.imported/);
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
  assert.doesNotMatch(text, /Снимок импортирован: \$safeName|Ошибка импорта \$\(_\.Name\)/);
});
