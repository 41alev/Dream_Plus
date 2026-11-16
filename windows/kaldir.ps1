<#
  Dream Plus otomatik baslatma gorevini ve guvenlik duvari kuralini kaldirir.
  VERILERE DOKUNMAZ: data\ klasoru (veritabani, yuklenen dosyalar, yedekler) yerinde kalir.
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'DreamPlus'
$FirewallRule = 'Dream Plus'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Gorev '$TaskName' durduruldu ve kaldirildi."
} else { Write-Host "Gorev '$TaskName' bulunamadi." }

$rule = Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue
if ($rule) { $rule | Remove-NetFirewallRule; Write-Host 'Guvenlik duvari kurali kaldirildi.' }

Write-Host "`nVeriler korundu: $(Join-Path (Split-Path -Parent $PSScriptRoot) 'data')"
