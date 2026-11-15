param([int]$Port = 8042)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $env:LOCALAPPDATA 'LuumIAV2'
$python = Join-Path $project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Crea .venv e instala las dependencias de LuumIA.' }

if (-not $env:DATABASE_URL) {
    $profilePath = Join-Path $runtime 'database-url.txt'
    if (-not (Test-Path -LiteralPath $profilePath)) { throw 'Configura DATABASE_URL con una base dedicada.' }
    $env:DATABASE_URL = (Get-Content -Raw -LiteralPath $profilePath).Trim()
}

$localKeyPath = Join-Path $runtime 'llm\api-key.txt'
if (-not $env:GEMINI_API_KEY -and -not $env:LUUMIA_LOCAL_LLM_URL -and (Test-Path -LiteralPath $localKeyPath)) {
    $env:LUUMIA_LOCAL_LLM_URL = 'http://127.0.0.1:8043'
    $env:LUUMIA_LOCAL_LLM_API_KEY = (Get-Content -Raw -LiteralPath $localKeyPath).Trim()
}

$koboKeyPath = Join-Path $runtime 'kobo-password.txt'
if (-not $env:LUUMIA_KOBO_PASSWORD -and (Test-Path -LiteralPath $koboKeyPath)) {
    $env:LUUMIA_KOBO_PASSWORD = (Get-Content -Raw -LiteralPath $koboKeyPath).Trim()
}

$env:PYTHONPATH = Join-Path $project 'backend\src'
$env:PYTHONUTF8 = '1'
& $python -m luumia.bootstrap
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $python -m uvicorn luumia.api:app --host 127.0.0.1 --port $Port
exit $LASTEXITCODE
