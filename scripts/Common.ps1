$ErrorActionPreference = 'Stop'
$RpgRoot = Split-Path -Parent $PSScriptRoot

function Set-RpgEnvironment {
    $env:OLLAMA_HOST = '127.0.0.1:11435'
    $env:OLLAMA_MODELS = Join-Path $RpgRoot 'models'
    $env:OLLAMA_TMPDIR = Join-Path $RpgRoot 'runtime\tmp'
    $env:OLLAMA_MAX_LOADED_MODELS = '2'
    $env:OLLAMA_NUM_PARALLEL = '1'
    $env:OLLAMA_CONTEXT_LENGTH = '8192'
    $env:OLLAMA_NO_CLOUD = '1'
    $env:PYTHONUTF8 = '1'
    $env:HF_HOME = Join-Path $RpgRoot 'models\huggingface'
    $env:HF_HUB_DISABLE_TELEMETRY = '1'
    New-Item -ItemType Directory -Force -Path (Join-Path $RpgRoot 'logs'), (Join-Path $RpgRoot 'data'), $env:OLLAMA_MODELS, $env:OLLAMA_TMPDIR | Out-Null
}

function Get-OwnedProcess($Record) {
    if (-not $Record) { return $null }
    $process = Get-Process -Id $Record.id -ErrorAction SilentlyContinue
    if ($process -and $process.Path -eq $Record.path -and [string]$process.StartTime.ToUniversalTime().Ticks -eq [string]$Record.started_ticks) {
        return $process
    }
    return $null
}

function Get-ProcessRecord($Process) {
    # Start-Process pode retornar antes de MainModule/Path estarem disponíveis.
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $fresh = Get-Process -Id $Process.Id -ErrorAction Stop
        if ($fresh.Path) {
            return @{ id = $fresh.Id; path = $fresh.Path; started_ticks = [string]$fresh.StartTime.ToUniversalTime().Ticks }
        }
        Start-Sleep -Milliseconds 100
    }
    throw 'Não foi possível registrar o executável do processo iniciado.'
}

function Test-LocalPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
