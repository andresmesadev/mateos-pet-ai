$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ok = $true

function Get-EnvValue([string]$file, [string]$name) {
  if (-not (Test-Path $file)) { return $null }
  $line = Get-Content -LiteralPath $file | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if ($line) { return $line.Substring($name.Length + 1) }
  return $null
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  $candidate = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
  if (Test-Path $candidate) { $docker = $candidate }
}
if ($docker) {
  $dockerBin = if ($docker -is [System.Management.Automation.CommandInfo]) { Split-Path $docker.Source } else { Split-Path $docker }
  $env:PATH = "$dockerBin;$env:PATH"
  $engine = & $docker version --format '{{.Server.Version}}' 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Output "OK Docker: $engine" }
  else { Write-Output 'ERROR Docker: abre Docker Desktop y espera a que el motor esté activo.'; $ok = $false }
} else {
  Write-Output 'ERROR Docker: instala Docker Desktop.'
  $ok = $false
}

foreach ($relative in @('.env', 'backend/.env')) {
  $url = Get-EnvValue (Join-Path $repo $relative) 'DATABASE_URL'
  try {
    $parsed = [uri]$url
    if ($parsed.Host -eq '127.0.0.1' -and $parsed.Port -eq 5433 -and $parsed.AbsolutePath -eq '/mateos_dev') {
      Write-Output "OK $relative apunta a PostgreSQL local"
    } else {
      Write-Output "ERROR $relative apunta a otro destino. Ejecuta scripts/setup-local-db.ps1."
      $ok = $false
    }
  } catch {
    Write-Output "ERROR $relative no tiene DATABASE_URL válida."
    $ok = $false
  }
}

$frontendApi = Get-EnvValue (Join-Path $repo 'frontend/.env.local') 'NEXT_PUBLIC_API_URL'
if ($frontendApi -in @('http://localhost:3000', 'http://127.0.0.1:3000')) {
  Write-Output 'OK frontend apunta al backend local'
} else {
  Write-Output 'ERROR frontend/.env.local debe apuntar a http://localhost:3000.'
  $ok = $false
}

try {
  $response = Invoke-WebRequest 'http://localhost:3000/api/health' -SkipHttpErrorCheck -UseBasicParsing -TimeoutSec 10
  $health = $response.Content | ConvertFrom-Json
  if ($response.StatusCode -eq 200 -and $health.services.database -eq 'ok') {
    Write-Output 'OK backend :3000 y base de datos'
  } else {
    Write-Output 'ERROR backend responde, pero la base o un servicio está degradado. Revisa /api/health.'
    $ok = $false
  }
} catch {
  Write-Output 'ERROR backend :3000 no responde. Inícialo desde backend/.'
  $ok = $false
}

try {
  $response = Invoke-WebRequest 'http://localhost:3010/login' -SkipHttpErrorCheck -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -eq 200) { Write-Output 'OK frontend :3010' }
  else { Write-Output 'ERROR frontend :3010 no responde correctamente.'; $ok = $false }
} catch {
  Write-Output 'ERROR frontend :3010 no responde. Inícialo con npm run dev -- --port 3010.'
  $ok = $false
}

if (-not $ok) { exit 1 }
Write-Output 'Entorno local listo para probar con datos persistentes.'
