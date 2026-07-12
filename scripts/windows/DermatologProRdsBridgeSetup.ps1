# Dermatolog Pro RDS Bridge setup for Windows 11.
# Run in Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\DermatologProRdsBridgeSetup.ps1

$ErrorActionPreference = "Stop"

$AppName = "Dermatolog Pro RDS Bridge"
$InstallRoot = Join-Path $env:LOCALAPPDATA "DermatologPro\RdsBridge"
$WorkerPath = Join-Path $InstallRoot "DermatologProRdsBridgeWorker.ps1"
$ConfigPath = Join-Path $InstallRoot "config.json"
$LogPath = Join-Path $InstallRoot "bridge.log"
$InstalledSetupPath = Join-Path $InstallRoot "DermatologProRdsBridgeSetup.ps1"
$DefaultWatchDir = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Dermatoscopy"

$WorkerScript = @'
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json")
)

$ErrorActionPreference = "Stop"

function Write-BridgeLog {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$stamp] $Message"
  Write-Host $line
  Add-Content -LiteralPath (Join-Path $PSScriptRoot "bridge.log") -Value $line -Encoding UTF8
}

function Read-Config {
  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Не найден файл настроек bridge."
  }
  return Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Get-PlainToken {
  param([string]$Cipher)
  $secure = ConvertTo-SecureString $Cipher
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Hide-SensitiveText {
  param([string]$Text, [object]$Config, [string]$PlainToken)
  $result = [string]$Text
  if ($Config.watchDir) {
    $result = $result.Replace([string]$Config.watchDir, "[папка снимков]")
  }
  if ($PlainToken) {
    $result = $result.Replace($PlainToken, "[ключ скрыт]")
  }
  return $result
}

function Read-Ledger {
  param([string]$LedgerPath)
  if (-not (Test-Path -LiteralPath $LedgerPath)) {
    return [pscustomobject]@{ imported = [pscustomobject]@{} }
  }
  try {
    $ledger = Get-Content -LiteralPath $LedgerPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -eq $ledger.imported) {
      throw "missing imported ledger section"
    }
    return $ledger
  } catch {
    throw "Журнал импорта повреждён. Восстановите его или удалите только после проверки уже импортированных снимков."
  }
}

function Save-Ledger {
  param([string]$LedgerPath, [object]$Ledger)
  Save-JsonAtomic -FilePath $LedgerPath -Value $Ledger
}

function Save-JsonAtomic {
  param([string]$FilePath, [object]$Value)
  $temporaryPath = "$FilePath.tmp"
  $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
  Move-Item -LiteralPath $temporaryPath -Destination $FilePath -Force
}

function Save-Receipt {
  param([string]$ReceiptPath, [object]$Receipt)
  Save-JsonAtomic -FilePath $ReceiptPath -Value $Receipt
}

function Get-ContentType {
  param([string]$FilePath)
  switch ([IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".png" { return "image/png" }
    ".webp" { return "image/webp" }
    ".heic" { return "image/heic" }
    ".heif" { return "image/heif" }
    default { return $null }
  }
}

function Get-SafeFileName {
  param([string]$FilePath)
  $name = [IO.Path]::GetFileName($FilePath)
  $safe = $name -replace '[^\p{L}\p{N}._ -]', '_'
  if ($safe.Length -gt 120) {
    return $safe.Substring(0, 120)
  }
  return $safe
}

function Get-FileSha256 {
  param([string]$FilePath)
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($FilePath)
  try {
    $hash = $sha.ComputeHash($stream)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
  } finally {
    $stream.Dispose()
    $sha.Dispose()
  }
}

function Test-StableFile {
  param([string]$FilePath, [int]$StableMilliseconds)
  $first = Get-Item -LiteralPath $FilePath
  Start-Sleep -Milliseconds $StableMilliseconds
  $second = Get-Item -LiteralPath $FilePath
  return ($first.Length -eq $second.Length) -and ($first.LastWriteTimeUtc -eq $second.LastWriteTimeUtc)
}

function Invoke-BridgeJson {
  param(
    [string]$Uri,
    [string]$Method,
    [hashtable]$Body,
    [string]$PlainToken
  )
  $headers = @{
    Accept = "application/json"
    Authorization = "Bearer $PlainToken"
  }
  $json = $Body | ConvertTo-Json -Depth 8
  return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers -ContentType "application/json; charset=utf-8" -Body $json
}

function Import-RdsImage {
  param([string]$FilePath, [object]$Config, [object]$Ledger, [string]$PlainToken)

  $contentType = Get-ContentType -FilePath $FilePath
  if (-not $contentType) {
    return
  }

  $file = Get-Item -LiteralPath $FilePath
  if ($file.Length -gt [int64]$Config.maxBytes) {
    Write-BridgeLog "Снимок пропущен: размер превышает 25 МБ."
    return
  }

  if (-not (Test-StableFile -FilePath $FilePath -StableMilliseconds ([int]$Config.stableMilliseconds))) {
    Write-BridgeLog "Снимок ещё сохраняется, повторю позже."
    return
  }

  $sha = Get-FileSha256 -FilePath $FilePath
  $existingProperty = $Ledger.imported.PSObject.Properties[$sha]
  $existing = if ($existingProperty) { $existingProperty.Value } else { $null }
  if ($existing -and ([string]$existing.status -ne "metadata_pending")) {
    return
  }

  $bytes = [IO.File]::ReadAllBytes($FilePath)
  $safeName = Get-SafeFileName -FilePath $FilePath
  $visit = [Uri]::EscapeDataString([string]$Config.visitId)
  $base = ([string]$Config.apiBaseUrl).TrimEnd("/")

  $assetBody = @{
    kind = "dermoscopy"
    contentType = $contentType
    byteSize = $bytes.Length
    checksumSha256 = $sha
    dataBase64 = [Convert]::ToBase64String($bytes)
    originalFileName = $safeName
    lesionId = if ($Config.lesionId) { [string]$Config.lesionId } else { $null }
    capturedAt = (Get-Date).ToUniversalTime().ToString("o")
  }

  $assetId = $null
  $correlationId = $null
  if ($existing -and ([string]$existing.status -eq "metadata_pending")) {
    $assetId = [string]$existing.assetId
    $correlationId = [string]$existing.correlationId
    if (-not $assetId) {
      throw "Незавершённый импорт не содержит номер снимка."
    }
  } else {
    $assetResponse = Invoke-BridgeJson -Uri "$base/api/v1/visits/$visit/assets" -Method "Post" -Body $assetBody -PlainToken $PlainToken
    $assetId = $assetResponse.item.id
    $correlationId = [string]$assetResponse.correlationId
    if (-not $assetId) {
      throw "Система не вернула номер импортированного снимка."
    }
    $pendingEntry = [ordered]@{
      fileName = $safeName
      assetId = [string]$assetId
      correlationId = $correlationId
      byteSize = $bytes.Length
      contentType = $contentType
      status = "metadata_pending"
    }
    $Ledger.imported | Add-Member -NotePropertyName $sha -NotePropertyValue $pendingEntry -Force
    Save-Ledger -LedgerPath $Config.ledgerPath -Ledger $Ledger
  }

  $encodedAsset = [Uri]::EscapeDataString([string]$assetId)
  $metadataBody = @{
    captureSource = "device_bridge"
    scaleMarkerDetected = $false
    millimetersAvailable = $false
    deviceCaptureProfile = "standard_dermoscopy"
    lightingProfile = "unknown"
    focusProfile = "unknown"
    distanceProfile = "unknown"
    deviceCalibrationStatus = "unknown"
    captureProtocolVersion = "imported_standard"
    lensProfile = "dermoscope_contact"
    polarizationMode = "unknown"
    colorReferenceStatus = "unknown"
    deviceClockSyncStatus = "synced"
  }

  Invoke-BridgeJson -Uri "$base/api/v1/visits/$visit/assets/$encodedAsset/capture-metadata" -Method "Patch" -Body $metadataBody -PlainToken $PlainToken | Out-Null

  $importedAt = (Get-Date).ToUniversalTime().ToString("o")
  $entry = [ordered]@{
    fileName = $safeName
    assetId = [string]$assetId
    correlationId = $correlationId
    importedAt = $importedAt
    byteSize = $bytes.Length
    contentType = $contentType
    status = "imported"
  }
  $Ledger.imported | Add-Member -NotePropertyName $sha -NotePropertyValue $entry -Force
  Save-Ledger -LedgerPath $Config.ledgerPath -Ledger $Ledger
  $receipt = [ordered]@{
    schemaVersion = 1
    status = "imported"
    assetId = [string]$assetId
    checksumSha256 = $sha
    correlationId = $correlationId
    captureSource = "device_bridge"
    importedAt = $importedAt
  }
  Save-Receipt -ReceiptPath $Config.receiptPath -Receipt $receipt
  Write-BridgeLog "Снимок импортирован."
}

function Scan-RdsFolder {
  param([object]$Config, [object]$Ledger, [string]$PlainToken)
  $extensions = @(".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")
  Get-ChildItem -LiteralPath $Config.watchDir -File | Where-Object {
    $extensions -contains $_.Extension.ToLowerInvariant()
  } | Sort-Object LastWriteTimeUtc | ForEach-Object {
    try {
      Import-RdsImage -FilePath $_.FullName -Config $Config -Ledger $Ledger -PlainToken $PlainToken
    } catch {
      $message = Hide-SensitiveText -Text $_.Exception.Message -Config $Config -PlainToken $PlainToken
      Write-BridgeLog "Ошибка импорта снимка: $message"
    }
  }
}

$config = Read-Config
$plainToken = Get-PlainToken -Cipher ([string]$config.tokenCipher)
if (-not (Test-Path -LiteralPath $config.watchDir)) {
  New-Item -ItemType Directory -Path $config.watchDir -Force | Out-Null
}
$ledger = Read-Ledger -LedgerPath $config.ledgerPath
Write-BridgeLog "Bridge запущен. Папка снимков подключена."

while ($true) {
  Scan-RdsFolder -Config $config -Ledger $ledger -PlainToken $plainToken
  Start-Sleep -Seconds ([int]$config.pollSeconds)
}
'@

function Add-WindowsForms {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName Microsoft.VisualBasic
  [System.Windows.Forms.Application]::EnableVisualStyles()
}

function Choose-RdsFolder {
  param([string]$DefaultPath)
  if (-not (Test-Path -LiteralPath $DefaultPath)) {
    New-Item -ItemType Directory -Path $DefaultPath -Force | Out-Null
  }
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = "Выберите папку, куда программа РДС-3 сохраняет снимки"
  $dialog.SelectedPath = $DefaultPath
  $dialog.ShowNewFolderButton = $true
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "Установка отменена: папка снимков не выбрана."
  }
  return $dialog.SelectedPath
}

function Ask-Text {
  param([string]$Title, [string]$Prompt, [string]$DefaultValue = "")
  $value = [Microsoft.VisualBasic.Interaction]::InputBox($Prompt, $Title, $DefaultValue)
  return [string]$value.Trim()
}

function New-BridgeShortcut {
  param([string]$ShortcutPath, [string]$TargetPath, [string]$Arguments, [string]$WorkingDirectory)
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
  $shortcut.Save()
}

function Assert-RequiredText {
  param([string]$Value, [string]$FieldName)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Поле '$FieldName' обязательно."
  }
}

Add-WindowsForms

Write-Host ""
Write-Host "Dermatolog Pro RDS Bridge"
Write-Host "Установка bridge для импорта снимков РДС-3 из выбранной папки."
Write-Host ""

$watchDir = Choose-RdsFolder -DefaultPath $DefaultWatchDir
$apiBaseUrl = Ask-Text -Title $AppName -Prompt "Адрес системы Dermatolog Pro" -DefaultValue "http://localhost:3001"
$visitId = Ask-Text -Title $AppName -Prompt "Номер визита в системе" -DefaultValue ""
$lesionId = Ask-Text -Title $AppName -Prompt "Номер очага, если известен. Можно оставить пустым." -DefaultValue ""

Assert-RequiredText -Value $apiBaseUrl -FieldName "Адрес системы"
Assert-RequiredText -Value $visitId -FieldName "Номер визита"

Write-Host "Введите ключ доступа к системе. Он будет сохранён только в зашифрованном виде для текущего пользователя Windows."
$secureToken = Read-Host "Ключ доступа" -AsSecureString
$tokenCipher = $secureToken | ConvertFrom-SecureString

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
Set-Content -LiteralPath $WorkerPath -Value $WorkerScript -Encoding UTF8
if ($PSCommandPath) {
  Copy-Item -LiteralPath $PSCommandPath -Destination $InstalledSetupPath -Force
}

$config = [ordered]@{
  watchDir = $watchDir
  apiBaseUrl = $apiBaseUrl.TrimEnd("/")
  tokenCipher = $tokenCipher
  visitId = $visitId
  lesionId = $lesionId
  ledgerPath = (Join-Path $watchDir ".dermatolog-pro-rds3-import-ledger.json")
  receiptPath = (Join-Path $InstallRoot "last-receipt.json")
  pollSeconds = 2
  stableMilliseconds = 1200
  maxBytes = 26214400
}
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$runArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$WorkerPath`""
$setupArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$InstalledSetupPath`""
$desktop = [Environment]::GetFolderPath("DesktopDirectory")
$programs = [Environment]::GetFolderPath("Programs")
$startMenuDir = Join-Path $programs "Dermatolog Pro"
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null

New-BridgeShortcut -ShortcutPath (Join-Path $desktop "Dermatolog Pro RDS Bridge.lnk") -TargetPath $powershellPath -Arguments $runArgs -WorkingDirectory $InstallRoot
New-BridgeShortcut -ShortcutPath (Join-Path $startMenuDir "Dermatolog Pro RDS Bridge.lnk") -TargetPath $powershellPath -Arguments $runArgs -WorkingDirectory $InstallRoot
if (Test-Path -LiteralPath $InstalledSetupPath) {
  New-BridgeShortcut -ShortcutPath (Join-Path $startMenuDir "Настроить Dermatolog Pro RDS Bridge.lnk") -TargetPath $powershellPath -Arguments $setupArgs -WorkingDirectory $InstallRoot
}

$startupAnswer = [System.Windows.Forms.MessageBox]::Show(
  "Запускать Dermatolog Pro RDS Bridge автоматически при входе в Windows?",
  $AppName,
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question
)
if ($startupAnswer -eq [System.Windows.Forms.DialogResult]::Yes) {
  $startupDir = [Environment]::GetFolderPath("Startup")
  New-BridgeShortcut -ShortcutPath (Join-Path $startupDir "Dermatolog Pro RDS Bridge.lnk") -TargetPath $powershellPath -Arguments $runArgs -WorkingDirectory $InstallRoot
}

$startAnswer = [System.Windows.Forms.MessageBox]::Show(
  "Установка завершена. Запустить bridge сейчас?",
  $AppName,
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question
)
if ($startAnswer -eq [System.Windows.Forms.DialogResult]::Yes) {
  Start-Process -FilePath $powershellPath -ArgumentList $runArgs -WorkingDirectory $InstallRoot
}

Write-Host ""
Write-Host "Готово."
Write-Host "Папка снимков: $watchDir"
Write-Host "Файлы bridge: $InstallRoot"
Write-Host "Лог: $LogPath"
