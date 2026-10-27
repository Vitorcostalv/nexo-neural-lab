. "$PSScriptRoot\Common.ps1"
Set-RpgEnvironment
$env:OPENBLAS_NUM_THREADS = '2'
$env:OMP_NUM_THREADS = '2'
$env:MKL_NUM_THREADS = '2'
$processFile = Join-Path $RpgRoot 'data\processes.json'
$records = @{}
if (Test-Path -LiteralPath $processFile) {
    $saved = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
    foreach ($name in @('ollama', 'api')) {
        if (Get-OwnedProcess $saved.$name) { $records[$name] = $saved.$name }
    }
}
foreach ($name in @('ollama', 'api')) {
    if ($records.ContainsKey($name)) { continue }
    $port = if ($name -eq 'ollama') { 11435 } else { 8000 }
    if (Test-LocalPort $port) { throw "Porta $port ocupada por outro processo. Nenhum processo externo será encerrado." }
    if ($name -eq 'ollama') {
        $executable = Join-Path $RpgRoot 'runtime\ollama\ollama.exe'
        $arguments = 'serve'
    } else {
        $executable = Join-Path $RpgRoot '.venv\Scripts\python.exe'
        $arguments = '-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1'
    }
    if (-not (Test-Path -LiteralPath $executable)) { throw "Dependência ausente: $executable. Consulte a instalação no README.md." }
    $process = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $RpgRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $RpgRoot "logs\$name.out.log") -RedirectStandardError (Join-Path $RpgRoot "logs\$name.err.log")
    $records[$name] = Get-ProcessRecord $process
    $records | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $processFile -Encoding utf8
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-LocalPort $port) { break }
        Start-Sleep -Milliseconds 500
        if ($process.HasExited) { throw "$name encerrou. Consulte logs\$name.err.log." }
    }
    if (-not (Test-LocalPort $port)) { throw "$name demorou para iniciar. Consulte os logs." }
}
Write-Output 'Nexo - Laboratorio neural: http://127.0.0.1:8000'
Write-Output 'Documentação interativa: http://127.0.0.1:8000/docs'
Write-Output 'Para parar: powershell -ExecutionPolicy Bypass -File scripts\Stop.ps1'
