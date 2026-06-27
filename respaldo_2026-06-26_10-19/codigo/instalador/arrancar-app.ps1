# Arranca Sanmy Taller oculto, lo abre como ventana de aplicacion y
# DETIENE el servidor automaticamente cuando se cierra esa ventana.
param([int]$Port = 3020)

$ErrorActionPreference = 'SilentlyContinue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$health = "http://127.0.0.1:$Port/api/health"
$url = "http://localhost:$Port/abrir.html"
$perfil = Join-Path $Root 'browser-profile'

function Test-Activo {
    try {
        $r = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Stop-TallerServer {
    $pidFile = Join-Path $Root 'sanmy-taller-servidor.pid'
    if (Test-Path $pidFile) {
        $serverPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($serverPid) {
            Stop-Process -Id ([int]$serverPid) -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

function Get-AppProcs {
    Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($perfil) }
}

# 1) Arrancar el servidor si no esta activo
if (-not (Test-Activo)) {
    & (Join-Path $PSScriptRoot 'iniciar-servidor-oculto.ps1') -Root $Root | Out-Null
    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-Date) -lt $deadline) {
        if (Test-Activo) { break }
        Start-Sleep -Milliseconds 700
    }
}

if (-not (Test-Activo)) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "No se pudo iniciar el servidor de Sanmy Taller en el puerto $Port.`n`nRevise el archivo:`n$Root\logs\sanmy-taller-servidor-error.log`n`nTambién puede ejecutar ABRIR-SISTEMA.bat desde la carpeta del programa.",
        'Sanmy Taller',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    Start-Process $url
    return
}

# 2) Localizar navegador (Chrome o Edge)
$chrome = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LocalAppData 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$edge = @(
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$argsBrowser = @(
    "--app=$url",
    "--user-data-dir=$perfil",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    "--start-maximized"
)

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList $argsBrowser | Out-Null
} elseif ($edge) {
    Start-Process -FilePath $edge -ArgumentList $argsBrowser | Out-Null
} else {
    # Sin Chrome/Edge no se puede auto-cerrar; abrir en navegador por defecto
    Start-Process $url
    return
}

# 3) Esperar a que la ventana de la app exista y luego se cierre
$try = 0
while (-not (Get-AppProcs) -and $try -lt 20) {
    Start-Sleep -Milliseconds 700
    $try++
}
while (Get-AppProcs) {
    Start-Sleep -Seconds 2
}

# 4) La ventana se cerro: detener el servidor
Stop-TallerServer
