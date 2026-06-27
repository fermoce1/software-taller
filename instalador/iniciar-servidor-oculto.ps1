# Inicia Sanmy Taller en segundo plano (puerto 3020)
param(
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
$Port = 3020

if (-not $Root) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
} else {
    $Root = (Resolve-Path $Root).Path
}

function Get-NodeExe {
    param([string]$Base)
    $local = Join-Path $Base 'runtime\node\node.exe'
    if (Test-Path $local) { return $local }
    $prog = 'C:\Program Files\nodejs\node.exe'
    if (Test-Path $prog) { return $prog }
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 2
    if ($health.StatusCode -eq 200) {
        exit 0
    }
} catch {
    # servidor no activo
}

$node = Get-NodeExe -Base $Root
if (-not $node) {
    Write-Error 'Node.js no encontrado'
    exit 1
}

$express = Join-Path $Root 'node_modules\express'
if (-not (Test-Path $express)) {
    $npm = Join-Path (Split-Path $node -Parent) 'npm.cmd'
    if (-not (Test-Path $npm)) {
        $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
        if ($npmCmd) { $npm = $npmCmd.Source }
    }
    if ($npm) {
        $npmProc = Start-Process -FilePath $npm -ArgumentList @(
            'install', '--no-fund', '--no-audit'
        ) -WorkingDirectory $Root -Wait -PassThru -WindowStyle Hidden -NoNewWindow
        if ($npmProc.ExitCode -ne 0) {
            Write-Error 'npm install fallo'
            exit 1
        }
    }
}

$logDir = Join-Path $Root 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logOut = Join-Path $logDir 'sanmy-taller-servidor.log'
$logErr = Join-Path $logDir 'sanmy-taller-servidor-error.log'
$pidFile = Join-Path $Root 'sanmy-taller-servidor.pid'

$p = Start-Process -FilePath $node -ArgumentList @('server.js') `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr

Set-Content -Path $pidFile -Value $p.Id -Encoding ascii
exit 0
