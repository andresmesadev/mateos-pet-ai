param(
    [Parameter(Mandatory = $true)][string]$NodeExecutable,
    [Parameter(Mandatory = $true)][string]$IdentityPath,
    [ValidatePattern('^[a-z_][a-z0-9_-]*@[a-z0-9][a-z0-9.-]*$')][string]$SshDestination = 'ubuntu@149.130.191.53'
)
$ErrorActionPreference = 'Stop'
try {
    Set-Location -LiteralPath (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
    & $NodeExecutable (Join-Path $PSScriptRoot 'copy-offsite-backup.cjs') --identity $IdentityPath --host $SshDestination
    exit $LASTEXITCODE
} catch {
    Write-Error 'No se pudo ejecutar la copia cifrada. Comprueba rutas, permisos y disponibilidad del equipo.' -ErrorAction Continue
    exit 1
}
