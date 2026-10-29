# Crea le due attività pianificate di blackbox-intel (mattina 08:00, sera 21:00, ora del PC).
# Uso, da questa cartella:  powershell -ExecutionPolicy Bypass -File .\setup_tasks.ps1
# Per toglierle:            powershell -ExecutionPolicy Bypass -File .\setup_tasks.ps1 -Remove
param([switch]$Remove)

$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot
$uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uv) { throw "uv non trovato nel PATH: installalo con  winget install astral-sh.uv  e riapri il terminale" }

$tz = (Get-TimeZone).Id
if ($tz -ne "W. Europe Standard Time") {
    Write-Warning "Il fuso del PC è '$tz', non quello di Roma: le 08:00 e le 21:00 sono nell'ora del PC."
}

foreach ($slot in @(@{Name = "blackbox-intel mattina"; Slot = "mattina"; At = "08:00"},
                    @{Name = "blackbox-intel sera";    Slot = "sera";    At = "21:00"})) {
    if (Get-ScheduledTask -TaskName $slot.Name -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $slot.Name -Confirm:$false
    }
    if ($Remove) { Write-Host "Rimossa: $($slot.Name)"; continue }

    # cmd /c per avere il log del run in logs\
    $log = Join-Path $dir "logs\run-$($slot.Slot).log"
    $action = New-ScheduledTaskAction -Execute "cmd.exe" `
        -Argument "/c `"`"$uv`" run intel run --slot $($slot.Slot) > `"$log`" 2>&1`"" -WorkingDirectory $dir
    $trigger = New-ScheduledTaskTrigger -Daily -At $slot.At
    # Riattiva il computer · Esegui il prima possibile dopo un avvio saltato · massimo 4 ore
    # (il run aspetta la puntata fino a 2 ore) · niente seconda istanza in parallelo
    $settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    # gira col tuo utente, solo se hai fatto l'accesso: claude -p usa il tuo login
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $slot.Name -Action $action -Trigger $trigger -Settings $settings `
        -Principal $principal -Description "blackbox-intel: digest $($slot.Slot) dopo la puntata di Black Box" | Out-Null
    Write-Host "Creata: $($slot.Name) alle $($slot.At)"
}
if (-not $Remove) {
    Write-Host ""
    Write-Host "Controlla in Utilità di pianificazione > Libreria. Prova subito un run con:"
    Write-Host "  Start-ScheduledTask -TaskName 'blackbox-intel mattina'"
}
