# Dermatolog Pro RDS Bridge setup for Windows 10 and 11.
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

$mutexCreated = $false
$bridgeMutex = [System.Threading.Mutex]::new(
  $true,
  "Local\DermatologProRdsBridge",
  [ref]$mutexCreated
)
if (-not $mutexCreated) {
  $bridgeMutex.Dispose()
  Write-Host "Dermatolog Pro RDS Bridge уже запущен."
  exit 0
}

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

function Get-PlainSecret {
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
  param(
    [string]$Text,
    [object]$Config,
    [string]$PlainEmail,
    [string]$PlainPassword,
    [string]$PlainToken
  )
  $result = [string]$Text
  if ($Config.watchDir) {
    $result = $result.Replace([string]$Config.watchDir, "[папка снимков]")
  }
  if ($Config.visitId) {
    $result = $result.Replace([string]$Config.visitId, "[номер визита скрыт]")
  }
  if ($Config.lesionId) {
    $result = $result.Replace([string]$Config.lesionId, "[номер очага скрыт]")
  }
  if ($PlainEmail) {
    $result = $result.Replace($PlainEmail, "[почта скрыта]")
  }
  if ($PlainPassword) {
    $result = $result.Replace($PlainPassword, "[пароль скрыт]")
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

function Invoke-BridgeLogin {
  param([object]$Config, [string]$PlainEmail, [string]$PlainPassword)
  $base = ([string]$Config.apiBaseUrl).TrimEnd("/")
  $body = @{
    email = $PlainEmail
    password = $PlainPassword
  } | ConvertTo-Json
  $login = Invoke-RestMethod `
    -Uri "$base/api/v1/auth/login" `
    -Method "Post" `
    -Headers @{ Accept = "application/json" } `
    -ContentType "application/json; charset=utf-8" `
    -Body $body
  $accessToken = [string]$login.accessToken
  if (-not $accessToken) {
    throw "Система не вернула ключ рабочей сессии."
  }
  $assistantRoles = @($login.user.roles | Where-Object { [string]$_.role -eq "assistant" })
  if ($assistantRoles.Count -eq 0) {
    throw "Для импорта снимков нужна учётная запись ассистента."
  }
  $expiresInSeconds = 3600
  if ($login.expiresInSeconds -and [int]$login.expiresInSeconds -gt 0) {
    $expiresInSeconds = [int]$login.expiresInSeconds
  }
  $refreshAfterSeconds = $expiresInSeconds - 120
  if ($refreshAfterSeconds -lt 30) {
    $refreshAfterSeconds = 30
  }
  return [pscustomobject]@{
    accessToken = $accessToken
    expiresAt = (Get-Date).ToUniversalTime().AddSeconds($refreshAfterSeconds)
  }
}

function Get-BridgeSession {
  param(
    [object]$Config,
    [string]$PlainEmail,
    [string]$PlainPassword,
    [object]$Session
  )
  if ($null -eq $Session -or (Get-Date).ToUniversalTime() -ge [datetime]$Session.expiresAt) {
    return Invoke-BridgeLogin -Config $Config -PlainEmail $PlainEmail -PlainPassword $PlainPassword
  }
  return $Session
}

function Invoke-BridgeJson {
  param(
    [string]$Uri,
    [string]$Method,
    [hashtable]$Body,
    [string]$PlainToken,
    [string]$IdempotencyKey = ""
  )
  $headers = @{
    Accept = "application/json"
    Authorization = "Bearer $PlainToken"
  }
  if ($IdempotencyKey) {
    $headers["Idempotency-Key"] = $IdempotencyKey
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
  $idempotencyKey = "rds3-$($Config.visitId)-$sha"

  $assetBody = @{
    kind = "dermoscopy"
    contentType = $contentType
    byteSize = $bytes.Length
    checksumSha256 = $sha
    dataBase64 = [Convert]::ToBase64String($bytes)
    originalFileName = $safeName
    lesionId = if ($Config.lesionId) { [string]$Config.lesionId } else { $null }
    capturedAt = $file.LastWriteTimeUtc.ToString("o")
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
    $assetResponse = Invoke-BridgeJson -Uri "$base/api/v1/visits/$visit/assets" -Method "Post" -Body $assetBody -PlainToken $PlainToken -IdempotencyKey $idempotencyKey
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
  param(
    [object]$Config,
    [object]$Ledger,
    [string]$PlainEmail,
    [string]$PlainPassword,
    [string]$PlainToken
  )
  $extensions = @(".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")
  Get-ChildItem -LiteralPath $Config.watchDir -File | Where-Object {
    $extensions -contains $_.Extension.ToLowerInvariant()
  } | Sort-Object LastWriteTimeUtc | ForEach-Object {
    try {
      Import-RdsImage -FilePath $_.FullName -Config $Config -Ledger $Ledger -PlainToken $PlainToken
    } catch {
      $message = Hide-SensitiveText `
        -Text $_.Exception.Message `
        -Config $Config `
        -PlainEmail $PlainEmail `
        -PlainPassword $PlainPassword `
        -PlainToken $PlainToken
      Write-BridgeLog "Ошибка импорта снимка: $message"
    }
  }
}

$config = Read-Config
if (-not $config.emailCipher -or -not $config.passwordCipher) {
  Write-BridgeLog "Настройки bridge устарели. Запустите настройку повторно."
  exit 1
}
$plainEmail = Get-PlainSecret -Cipher ([string]$config.emailCipher)
$plainPassword = Get-PlainSecret -Cipher ([string]$config.passwordCipher)
$session = $null
if (-not (Test-Path -LiteralPath $config.watchDir)) {
  New-Item -ItemType Directory -Path $config.watchDir -Force | Out-Null
}
$ledger = Read-Ledger -LedgerPath $config.ledgerPath
Write-BridgeLog "Bridge запущен. Папка снимков подключена."

while ($true) {
  try {
    $session = Get-BridgeSession `
      -Config $config `
      -PlainEmail $plainEmail `
      -PlainPassword $plainPassword `
      -Session $session
    Scan-RdsFolder `
      -Config $config `
      -Ledger $ledger `
      -PlainEmail $plainEmail `
      -PlainPassword $plainPassword `
      -PlainToken ([string]$session.accessToken)
  } catch {
    $plainToken = if ($session) { [string]$session.accessToken } else { "" }
    $message = Hide-SensitiveText `
      -Text $_.Exception.Message `
      -Config $config `
      -PlainEmail $plainEmail `
      -PlainPassword $plainPassword `
      -PlainToken $plainToken
    Write-BridgeLog "Ошибка подключения к системе: $message"
    $session = $null
    Start-Sleep -Seconds ([int]$config.retrySeconds)
    continue
  }
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
    return $null
  }
  return $dialog.SelectedPath
}

function Ask-Text {
  param([string]$Title, [string]$Prompt, [string]$DefaultValue = "")
  $value = [Microsoft.VisualBasic.Interaction]::InputBox($Prompt, $Title, $DefaultValue)
  return [string]$value.Trim()
}

function Confirm-RetryInput {
  param([string]$Message)
  $result = [System.Windows.Forms.MessageBox]::Show(
    "$Message`n`nПовторить ввод?",
    $AppName,
    [System.Windows.Forms.MessageBoxButtons]::RetryCancel,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  )
  return $result -eq [System.Windows.Forms.DialogResult]::Retry
}

function Ask-RequiredText {
  param([string]$Title, [string]$Prompt, [string]$DefaultValue, [string]$FieldName)
  while ($true) {
    $value = Ask-Text -Title $Title -Prompt $Prompt -DefaultValue $DefaultValue
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value
    }
    if (-not (Confirm-RetryInput -Message "Поле '$FieldName' обязательно.")) {
      return $null
    }
  }
}

function Get-PlainSecureString {
  param([Security.SecureString]$SecureValue)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Test-BridgeAccess {
  param(
    [string]$ApiBaseUrl,
    [string]$Email,
    [Security.SecureString]$SecurePassword
  )
  $plainPassword = Get-PlainSecureString -SecureValue $SecurePassword
  try {
    $base = $ApiBaseUrl.TrimEnd("/")
    $loginBody = @{
      email = $Email
      password = $plainPassword
    } | ConvertTo-Json
    $login = Invoke-RestMethod `
      -Uri "$base/api/v1/auth/login" `
      -Method "Post" `
      -Headers @{ Accept = "application/json" } `
      -ContentType "application/json; charset=utf-8" `
      -Body $loginBody
    $accessToken = [string]$login.accessToken
    if (-not $accessToken) {
      throw "Система не вернула ключ рабочей сессии."
    }
    $assistantRoles = @($login.user.roles | Where-Object { [string]$_.role -eq "assistant" })
    if ($assistantRoles.Count -eq 0) {
      throw "Для импорта снимков нужна учётная запись ассистента."
    }
    $visitResponse = Invoke-RestMethod `
      -Uri "$base/api/v1/visits?limit=50" `
      -Method "Get" `
      -Headers @{
        Accept = "application/json"
        Authorization = "Bearer $accessToken"
      }
    $visits = @($visitResponse.items | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.id) })
    if ($visits.Count -eq 0) {
      throw "Для ассистента нет доступных визитов."
    }
    return $visits
  } finally {
    $plainPassword = $null
  }
}

function Choose-Visit {
  param([object[]]$Visits)
  $statusLabels = @{
    draft = "запланирован"
    in_progress = "идёт приём"
    signed = "завершён"
    cancelled = "отменён"
  }
  $choices = @(
    $Visits | ForEach-Object {
      $visit = $_
      $patientName = [string]$visit.patient.fullName
      if ([string]::IsNullOrWhiteSpace($patientName)) {
        $patientName = "Пациент не указан"
      }
      $startedAt = "дата не указана"
      if ($visit.startedAt) {
        try {
          $startedAt = ([DateTimeOffset]::Parse([string]$visit.startedAt)).LocalDateTime.ToString("dd.MM.yyyy HH:mm")
        } catch {
          $startedAt = "дата не указана"
        }
      }
      $status = [string]$visit.status
      $statusLabel = if ($statusLabels.ContainsKey($status)) { $statusLabels[$status] } else { "статус не указан" }
      [pscustomobject]@{
        Label = "$patientName · $startedAt · $statusLabel"
        Id = [string]$visit.id
      }
    }
  )

  $form = New-Object System.Windows.Forms.Form
  $form.Text = $AppName
  $form.Width = 650
  $form.Height = 190
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false

  $label = New-Object System.Windows.Forms.Label
  $label.Left = 20
  $label.Top = 20
  $label.Width = 590
  $label.Height = 32
  $label.Text = "Выберите визит, к которому bridge будет добавлять снимки."
  $form.Controls.Add($label)

  $combo = New-Object System.Windows.Forms.ComboBox
  $combo.Left = 20
  $combo.Top = 55
  $combo.Width = 590
  $combo.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
  $combo.DisplayMember = "Label"
  foreach ($choice in $choices) {
    [void]$combo.Items.Add($choice)
  }
  if ($combo.Items.Count -gt 0) {
    $combo.SelectedIndex = 0
  }
  $form.Controls.Add($combo)

  $selectButton = New-Object System.Windows.Forms.Button
  $selectButton.Text = "Выбрать"
  $selectButton.Left = 430
  $selectButton.Top = 100
  $selectButton.Width = 85
  $selectButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.AcceptButton = $selectButton
  $form.Controls.Add($selectButton)

  $cancelButton = New-Object System.Windows.Forms.Button
  $cancelButton.Text = "Отмена"
  $cancelButton.Left = 525
  $cancelButton.Top = 100
  $cancelButton.Width = 85
  $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $form.CancelButton = $cancelButton
  $form.Controls.Add($cancelButton)

  $dialogResult = $form.ShowDialog()
  $selectedVisitId = if ($dialogResult -eq [System.Windows.Forms.DialogResult]::OK) {
    [string]$combo.SelectedItem.Id
  } else {
    $null
  }
  $form.Dispose()
  if ($null -eq $selectedVisitId) {
    return $null
  }
  return $selectedVisitId
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

function Stop-RunningBridge {
  param([string]$WorkerPath)
  $processes = @(
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -in @("powershell.exe", "pwsh.exe") -and
      $_.CommandLine -like "*$WorkerPath*"
    }
  )
  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
  }
}

Add-WindowsForms

Write-Host ""
Write-Host "Dermatolog Pro RDS Bridge"
Write-Host "Установка bridge для импорта снимков РДС-3 из выбранной папки."
Write-Host ""

$watchDir = Choose-RdsFolder -DefaultPath $DefaultWatchDir
if (-not $watchDir) {
  Write-Host "Установка отменена пользователем."
  exit 0
}

$apiBaseUrl = Ask-RequiredText -Title $AppName -Prompt "Адрес системы Dermatolog Pro" -DefaultValue "https://pro.skindoktor.ru" -FieldName "Адрес системы"
if ($null -eq $apiBaseUrl) {
  Write-Host "Установка отменена пользователем."
  exit 0
}

$emailCipher = $null
$passwordCipher = $null
$availableVisits = @()
while ($true) {
  $email = Ask-RequiredText `
    -Title $AppName `
    -Prompt "Рабочая почта ассистента" `
    -DefaultValue "" `
    -FieldName "Рабочая почта ассистента"
  if ($null -eq $email) {
    Write-Host "Установка отменена пользователем."
    exit 0
  }
  Write-Host "Введите пароль ассистента. Данные входа будут зашифрованы для текущего пользователя Windows."
  $securePassword = Read-Host "Пароль ассистента" -AsSecureString
  try {
    $availableVisits = @(
      Test-BridgeAccess `
      -ApiBaseUrl $apiBaseUrl `
      -Email $email `
      -SecurePassword $securePassword
    )
    $secureEmail = ConvertTo-SecureString -String $email -AsPlainText -Force
    $emailCipher = $secureEmail | ConvertFrom-SecureString
    $passwordCipher = $securePassword | ConvertFrom-SecureString
    break
  } catch {
    if (-not (Confirm-RetryInput -Message "Не удалось войти как ассистент или загрузить доступные визиты. Проверьте почту, пароль и подключение к системе.")) {
      Write-Host "Установка отменена пользователем."
      exit 0
    }
  }
}

$email = $null
$secureEmail = $null
$securePassword = $null
$visitId = Choose-Visit -Visits $availableVisits
$availableVisits = $null
if ($null -eq $visitId) {
  Write-Host "Установка отменена пользователем."
  exit 0
}

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
Stop-RunningBridge -WorkerPath $WorkerPath
Set-Content -LiteralPath $WorkerPath -Value $WorkerScript -Encoding UTF8
if ($PSCommandPath) {
  Copy-Item -LiteralPath $PSCommandPath -Destination $InstalledSetupPath -Force
}

$config = [ordered]@{
  watchDir = $watchDir
  apiBaseUrl = $apiBaseUrl.TrimEnd("/")
  emailCipher = $emailCipher
  passwordCipher = $passwordCipher
  visitId = $visitId
  lesionId = ""
  ledgerPath = (Join-Path $watchDir ".dermatolog-pro-rds3-import-ledger.json")
  receiptPath = (Join-Path $InstallRoot "last-receipt.json")
  pollSeconds = 2
  retrySeconds = 15
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
