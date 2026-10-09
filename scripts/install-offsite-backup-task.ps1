[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$IdentityPath,
    [ValidatePattern('^[a-z_][a-z0-9_-]*@[a-z0-9][a-z0-9.-]*$')][string]$SshDestination = 'ubuntu@149.130.191.53',
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$taskName = 'MateosPetAI-OffsiteBackup'
$repoDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runnerScript = Join-Path $PSScriptRoot 'run-offsite-backup-task.ps1'
$identityFile = (Resolve-Path -LiteralPath $IdentityPath).Path
if (-not (Test-Path -LiteralPath $identityFile -PathType Leaf)) { throw 'La ruta de la identidad SSH debe ser un archivo existente.' }
$nodeExecutable = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
# Codex may supply a temporary PowerShell runtime. Use the installed Windows
# executable so the scheduled action remains available outside this session.
$powershellExecutable = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $powershellExecutable -PathType Leaf)) { throw 'No se encontró Windows PowerShell para ejecutar la tarea.' }
Get-Command ssh -CommandType Application -ErrorAction Stop | Out-Null

# The trigger uses the Windows timezone; do not silently change the operator's clock.
if ((Get-TimeZone).Id -ne 'SA Pacific Standard Time') {
    throw 'Configura explícitamente la hora de la tarea: este instalador requiere la zona de Bogotá (SA Pacific Standard Time). No se modificó la zona del equipo.'
}
$accountName = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$actionArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}" -NodeExecutable "{1}" -IdentityPath "{2}" -SshDestination "{3}"' -f $runnerScript, $nodeExecutable, $identityFile, $SshDestination
$existing = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue
if ($existing) {
    $actions = @($existing.Actions)
    $legacyRuntime = Join-Path $PSHOME 'powershell.exe'
    $knownExecutable = $actions.Count -eq 1 -and (
        $actions[0].Execute -eq $powershellExecutable -or
        ($actions[0].Execute -eq $legacyRuntime -and -not (Test-Path -LiteralPath $legacyRuntime -PathType Leaf))
    )
    $sameOwner = $existing.Principal.UserId -in @($accountName, ($accountName -split '\\')[-1])
    if (-not $knownExecutable -or -not $sameOwner -or $actions[0].Arguments -ne $actionArguments -or $actions[0].WorkingDirectory -ne $repoDirectory) {
        throw 'Ya existe una tarea con ese nombre y otra configuración; no se reemplazó.'
    }
}

$plan = [ordered]@{
    task = $taskName
    status = $(if ($existing) { 'registered_unchanged' } else { 'prepared_not_registered' })
    source = $SshDestination
    payload = 'El último respaldo cifrado de PostgreSQL, manifest y SHA256SUMS'
    destination = (Join-Path $repoDirectory 'backups\offsite')
    account = $accountName
    schedule = 'Diaria 03:35 hora Colombia; al estar disponible si se omitió la hora'
    prerequisites = 'Equipo encendido y usuario conectado; Node y SSH existentes'
    removesExistingBackups = $false
}
if ($Install) {
    $action = New-ScheduledTaskAction -Execute $powershellExecutable -Argument $actionArguments -WorkingDirectory $repoDirectory
    $trigger = New-ScheduledTaskTrigger -Daily -At '03:35'
    $principal = New-ScheduledTaskPrincipal -UserId $accountName -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -TaskPath '\' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Copia de respaldo cifrado de Mateos Pet AI; requiere autorización del operador para transferencias periódicas.' -Force | Out-Null
    $plan.status = 'registered'
}
$plan | ConvertTo-Json -Compress
