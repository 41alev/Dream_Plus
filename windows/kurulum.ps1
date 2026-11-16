<#
  Dream Plus - Windows tek tik kurulum / one-click Windows installer.

  Normalde Kurulum.cmd cift tiklanarak calistirilir (yonetici izni ister).
  Yaptiklari:
    1. Node.js 22+ var mi kontrol eder (yoksa nereden kurulacagini soyler, kendisi indirmez)
    2. Uretim bagimliliklarini kurar (npm ci --omit=dev)
    3. .env dosyasini hazirlar; JWT_SECRET'i rastgele uretir
    4. Veritabani bossa ilk kurulumu (firma, yonetici, depo) calistirir
    5. Bilgisayar acilinca kendiliginden baslayan bir Windows gorevi kaydeder
       (LOCAL SERVICE hesabiyla, cokerse 5 sn sonra yeniden baslar)
    6. Istenirse ag erisimi icin guvenlik duvari kurali acar
    7. Sunucunun ayaga kalktigini dogrular ve tarayiciyi acar

  Parametreler:
    -NoService      Windows gorevi kaydetmez; sunucuyu yeni bir pencerede baslatir
    -OpenFirewall   Diger bilgisayarlardan erisim icin TCP portunu acar (Ozel/Etki alani aglari)
    -NoFirewall     Guvenlik duvari sorusunu sormadan kapali birakir
    -Port <n>       Varsayilan 3000
    -NoBrowser      Sonunda tarayiciyi acmaz
    -DryRun         Hicbir sey degistirmez; kaydedilecek gorevi gosterir
    -SetupArgs      npm run setup'a aynen gecirilir (otomasyon icin; sifre ADMIN_PASSWORD ortam degiskeninden)
#>
param(
  [switch]$NoService,
  [switch]$OpenFirewall,
  [switch]$NoFirewall,
  [int]$Port = 0,
  [switch]$NoBrowser,
  [switch]$DryRun,
  [string[]]$SetupArgs = @()
)

$ErrorActionPreference = 'Stop'
$TaskName = 'DreamPlus'
$FirewallRule = 'Dream Plus'
$AppDir = Split-Path -Parent $PSScriptRoot
Set-Location $AppDir

function Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Info([string]$m) { Write-Host "    $m" }
function Fail([string]$m) { Write-Host "`nHATA / ERROR: $m" -ForegroundColor Red; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $NoService -and -not $DryRun -and -not $isAdmin) {
  Fail 'Gorev kaydi icin yonetici izni gerekiyor. Kurulum.cmd dosyasini cift tiklayin (izin penceresi acilir) veya -NoService kullanin.'
}

# The service account (LOCAL SERVICE) cannot read user profile folders, and
# OneDrive/Dropbox syncing a live SQLite database can corrupt it.
if (-not $NoService) {
  $profileDir = [Environment]::GetFolderPath('UserProfile')
  if ($AppDir -like "$profileDir\*" -or $AppDir -match '\\(OneDrive|Dropbox|Google Drive)') {
    Fail "Program kullanici klasorunde veya bulut esitleme klasorunde: $AppDir`n       Klasoru ornegin C:\DreamPlus konumuna tasiyip Kurulum.cmd dosyasini oradan calistirin."
  }
}

# 1. Node.js
Step 'Node.js kontrol ediliyor / checking Node.js'
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Fail 'Node.js bulunamadi. https://nodejs.org adresinden 22 veya ustu LTS surumunu kurun, sonra Kurulum.cmd dosyasini tekrar calistirin.'
}
$nodeExe = $nodeCmd.Source
$nodeVersion = (& $nodeExe -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 22) { Fail "Node.js $nodeVersion kurulu; en az 22 gerekiyor." }
Info "Node.js $nodeVersion ($nodeExe)"

# 2. Dependencies
Step 'Bagimliliklar kuruluyor / installing dependencies'
if ($DryRun) { Info '(DryRun) npm ci --omit=dev atlandi' }
elseif (Test-Path (Join-Path $AppDir 'node_modules\better-sqlite3')) { Info 'Zaten kurulu / already installed' }
else {
  & npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail 'npm ci basarisiz oldu. Internet baglantisini kontrol edip tekrar deneyin.' }
}

# 3. .env
Step '.env hazirlaniyor / preparing .env'
if ($DryRun) {
  if (-not $Port) {
    $Port = 3000
    $envFile = Join-Path $AppDir '.env'
    if (Test-Path $envFile) {
      $line = Select-String -Path $envFile -Pattern '^PORT=(\d+)' | Select-Object -First 1
      if ($line) { $Port = [int]$line.Matches[0].Groups[1].Value }
    }
  }
  Info "(DryRun) port $Port"
}
else {
  $envArgs = @('windows\installer-helper.js', 'env')
  if ($Port) { $envArgs += @('--port', "$Port") }
  $Port = [int](& $nodeExe @envArgs)
  if ($LASTEXITCODE -ne 0) { Fail '.env hazirlanamadi.' }
  Info "Port: $Port"
}

# 4. First-time setup
Step 'Ilk kurulum kontrol ediliyor / checking first-time setup'
if (-not $DryRun) {
  & $nodeExe windows\installer-helper.js needs-setup
  $needs = $LASTEXITCODE
  if ($needs -eq 0) {
    Info 'Veritabani bos: firma ve yonetici bilgileri sorulacak.'
    & $nodeExe server\scripts\setup.js @SetupArgs
    if ($LASTEXITCODE -ne 0) { Fail 'Ilk kurulum tamamlanamadi.' }
  } elseif ($needs -eq 3) { Info 'Kurulum daha once yapilmis; veriler korunuyor.' }
  else { Fail 'Veritabani durumu okunamadi.' }
}

# 5. Auto-start task
$runner = Join-Path $AppDir 'windows\run-server.cmd'
if ($NoService) {
  Step 'Sunucu bu oturumda baslatiliyor (-NoService) / starting server for this session'
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Info "Port $Port zaten kullaniliyor; ikinci bir sunucu baslatilmadi."
  } elseif (-not $DryRun) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"`"$runner`" `"$nodeExe`"`"" -WorkingDirectory $AppDir -WindowStyle Minimized | Out-Null
  }
} else {
  Step 'Otomatik baslatma gorevi kaydediliyor / registering auto-start task'
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"`"$runner`" `"$nodeExe`"`"" -WorkingDirectory $AppDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description 'Dream Plus sunucusu. Kaldirmak icin Kaldir.cmd.'
  if ($DryRun) {
    Info "(DryRun) Gorev: $TaskName"
    Info "  Komut:   cmd.exe $($action.Arguments)"
    Info "  Klasor:  $($action.WorkingDirectory)"
    Info "  Hesap:   $($principal.UserId)  Tetik: bilgisayar acilisi"
  } else {
    # LOCAL SERVICE (S-1-5-19) reads the program and writes only to data\.
    & icacls $AppDir /grant '*S-1-5-19:(OI)(CI)RX' /T /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail 'Program klasorune okuma izni verilemedi.' }
    $dataDir = Join-Path $AppDir 'data'
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    & icacls $dataDir /grant '*S-1-5-19:(OI)(CI)M' /T /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail 'data klasorune izin verilemedi.' }
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
      Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    }
    Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Info "Gorev '$TaskName' kaydedildi ve baslatildi."
  }
}

# 6. Firewall (opt-in)
if (-not $NoFirewall -and -not $OpenFirewall -and -not $DryRun -and [Environment]::UserInteractive -and $isAdmin) {
  $answer = Read-Host "`nDiger bilgisayarlar bu sunucuya baglanacak mi? (E/H)"
  if ($answer -match '^[eEyY]') { $OpenFirewall = $true }
}
if ($OpenFirewall) {
  Step "Guvenlik duvari: TCP $Port aciliyor (Ozel/Etki alani aglari)"
  if ($DryRun) { Info '(DryRun) atlandi' }
  elseif (-not $isAdmin) { Info 'Yonetici izni olmadan acilamadi; atlandi.' }
  else {
    Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Protocol TCP -LocalPort $Port `
      -Action Allow -Profile Private, Domain | Out-Null
    Info 'Kural eklendi. Genel (Public) aglar kapali tutuldu.'
  }
}

# 7. Health
if ($DryRun) { Step 'DryRun tamamlandi; hicbir sey degistirilmedi.'; exit 0 }
Step 'Sunucunun acilmasi bekleniyor / waiting for the server'
& $nodeExe windows\installer-helper.js wait-health --port $Port --timeout 90
if ($LASTEXITCODE -ne 0) { Fail "Sunucu acilmadi. Ayrinti: $AppDir\data\logs\server.log" }

$lan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | Select-Object -First 1 -ExpandProperty IPAddress
Write-Host "`nKurulum tamamlandi / Installation complete" -ForegroundColor Green
Info "Bu bilgisayardan:  http://localhost:$Port"
if ($lan -and $OpenFirewall) { Info "Agdaki diger bilgisayarlardan:  http://${lan}:$Port" }
Info "Gunluk dosyasi:    $AppDir\data\logs\server.log"
Info 'Yedekler varsayilan olarak AYNI diskte tutulur; tesis disi yedek icin docs\KURULUM.md (BACKUP_OFFSITE_CMD).'
if (-not $NoBrowser) { Start-Process "http://localhost:$Port" }
