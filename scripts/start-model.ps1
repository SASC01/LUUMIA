$ErrorActionPreference = 'Stop'
$runtime = Join-Path $env:LOCALAPPDATA 'LuumIAV2\llm'
$server = Join-Path $runtime 'llama-b12377\llama-server.exe'
if (-not (Test-Path -LiteralPath $server)) { throw 'Se requiere llama.cpp y el modelo indicados en README.md.' }

Push-Location $runtime
try {
    & $server -m qwen2.5-1.5b-instruct-q4_k_m.gguf --alias qwen2.5-1.5b-instruct --host 127.0.0.1 --port 8043 `
        -c 2048 -t 4 -tb 8 -ngl 0 -np 1 --no-ui --cors-origins localhost --no-cors-credentials --api-key-file api-key.txt
} finally {
    Pop-Location
}
