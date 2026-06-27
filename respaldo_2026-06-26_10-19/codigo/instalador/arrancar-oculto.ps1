# Arranca Sanmy Taller sin mostrar ninguna ventana y abre el navegador.
param([int]$Port = 3020)

$ErrorActionPreference = 'SilentlyContinue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$health = "http://127.0.0.1:$Port/api/health"
$url = "http://localhost:$Port/abrir.html"

function Test-Activo {
    try {
        $r = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

if (-not (Test-Activo)) {
    # Inicia el servidor Node en segundo plano (ventana oculta, salida a logs)
    & (Join-Path $PSScriptRoot 'iniciar-servidor-oculto.ps1') -Root $Root | Out-Null

    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-Date) -lt $deadline) {
        if (Test-Activo) { break }
        Start-Sleep -Milliseconds 700
    }
}

Start-Process $url
