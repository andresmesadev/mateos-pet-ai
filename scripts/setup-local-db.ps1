$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendEnv = Join-Path $repo 'backend/.env'
$secretFile = Join-Path $repo '.env.local-db'

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  $perUserDocker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
  if (Test-Path $perUserDocker) { $docker = $perUserDocker }
}
if (-not $docker) {
  throw 'Docker Desktop no está disponible. Instálalo e inicia Docker antes de ejecutar este script.'
}
$dockerBin = if ($docker -is [System.Management.Automation.CommandInfo]) {
  Split-Path $docker.Source
} else {
  Split-Path $docker
}
$env:PATH = "$dockerBin;$env:PATH"
if (-not (Test-Path $backendEnv)) {
  throw 'Falta backend/.env. Cópialo desde backend/.env.example y configura el backend primero.'
}

if (-not (Test-Path $secretFile)) {
  $bytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $password = [Convert]::ToHexString($bytes).ToLowerInvariant()
  Set-Content -LiteralPath $secretFile -Value "MATEOS_DEV_DB_PASSWORD=$password" -Encoding utf8
}
$passwordLine = Get-Content -LiteralPath $secretFile | Where-Object { $_ -match '^MATEOS_DEV_DB_PASSWORD=[a-f0-9]{64}$' } | Select-Object -First 1
if (-not $passwordLine) { throw '.env.local-db no contiene una contraseña de desarrollo válida.' }
$password = $passwordLine.Substring('MATEOS_DEV_DB_PASSWORD='.Length)

Push-Location $repo
try {
  & $docker compose --env-file .env.local-db -f docker-compose.dev.yml up -d --wait
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL local.' }

  $env:DATABASE_URL = "postgresql://mateos_dev:$password@127.0.0.1:5433/mateos_dev"
  $env:MATEOS_LOCAL_DEV_SEED = '1'
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las migraciones locales.' }
  npx prisma generate
  if ($LASTEXITCODE -ne 0) { throw 'Falló prisma generate.' }

  Push-Location (Join-Path $repo 'backend')
  try {
    $bootstrap = node src/scripts/bootstrap-local-tenant.js
    if ($LASTEXITCODE -ne 0) { throw 'Falló el bootstrap del establecimiento local.' }
    $result = $bootstrap | Where-Object { $_ -match '^\{"tenantId":' } | Select-Object -Last 1 | ConvertFrom-Json
    if (-not $result.tenantId) { throw 'El bootstrap no devolvió tenantId.' }
    $env:SINGLE_TENANT_ID = $result.tenantId

    foreach ($seed in @('seed-event-types', 'seed-channels', 'seed-services', 'seed-staff', 'seed-local-dashboard')) {
      node "src/scripts/$seed.js"
      if ($LASTEXITCODE -ne 0) { throw "Falló $seed." }
    }
  } finally {
    Pop-Location
  }

  $backup = Join-Path $repo 'backend/.env.before-local-db'
  if (-not (Test-Path $backup)) { Copy-Item -LiteralPath $backendEnv -Destination $backup }
  $lines = @(Get-Content -LiteralPath $backendEnv)
  $values = @{
    DATABASE_URL = $env:DATABASE_URL
    SINGLE_TENANT_ID = $env:SINGLE_TENANT_ID
  }
  foreach ($key in $values.Keys) {
    $replacement = "$key=$($values[$key])"
    if ($lines | Where-Object { $_ -match "^$key=" }) {
      $lines = @($lines | ForEach-Object { if ($_ -match "^$key=") { $replacement } else { $_ } })
    } else {
      $lines += $replacement
    }
  }
  Set-Content -LiteralPath $backendEnv -Value $lines -Encoding utf8
  $rootEnv = Join-Path $repo '.env'
  if (Test-Path $rootEnv) {
    $rootBackup = Join-Path $repo '.env.before-local-db'
    if (-not (Test-Path $rootBackup)) { Copy-Item -LiteralPath $rootEnv -Destination $rootBackup }
    $rootLines = @(Get-Content -LiteralPath $rootEnv)
    if ($rootLines | Where-Object { $_ -match '^DATABASE_URL=' }) {
      $rootLines = @($rootLines | ForEach-Object { if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=$($env:DATABASE_URL)" } else { $_ } })
    } else {
      $rootLines += "DATABASE_URL=$($env:DATABASE_URL)"
    }
    Set-Content -LiteralPath $rootEnv -Value $rootLines -Encoding utf8
  }
  Write-Output 'PostgreSQL local listo en 127.0.0.1:5433, migraciones y datos de ejemplo aplicados.'
  Write-Output 'Reinicia el backend local para que lea el nuevo backend/.env.'
} finally {
  Pop-Location
  Remove-Item Env:DATABASE_URL, Env:SINGLE_TENANT_ID, Env:MATEOS_LOCAL_DEV_SEED -ErrorAction SilentlyContinue
}
