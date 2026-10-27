. "$PSScriptRoot\Common.ps1"
$processFile = Join-Path $RpgRoot 'data\processes.json'
if (-not (Test-Path -LiteralPath $processFile)) { Write-Output 'Nenhum processo registrado.'; exit 0 }
$records = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
foreach ($name in @('api', 'voice', 'speech', 'ollama')) {
    $process = Get-OwnedProcess $records.$name
    if ($process) {
        # /api/chat unload antes de encerrar o processo, para liberar a VRAM.
        if ($name -eq 'ollama') {
            foreach ($model in @('qwen3:4b', 'qwen3:8b', 'embeddinggemma:300m')) {
                try { $body=@{model=$model;keep_alive=0}|ConvertTo-Json; Invoke-RestMethod 'http://127.0.0.1:11435/api/generate' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 15 | Out-Null } catch { }
            }
        }
        # Windows venv launchers create a child Python process owning the port.
        # Kill the verified owned process tree, rather than leaving the child alive.
        & taskkill.exe /PID $process.Id /T /F | Out-Null
        Write-Output "$name encerrado."
    }
}
Remove-Item -LiteralPath $processFile
