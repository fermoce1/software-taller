# Prepara paquete ZIP para entregar a clientes (sin herramientas de vendedor)
param(
    [string]$OutputDir = '',
    [bool]$SkipNpm = $false
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
if (-not $OutputDir) {
    $OutputDir = Join-Path $Root 'dist\package'
}

$ExcludeDirs = @(
    'node_modules', '.git', 'dist', 'runtime', 'data', 'logs', 'browser-profile',
    'herramientas-vendedor', 'respaldo_2026-06-26_10-19'
)
$ExcludeDirPatterns = @('respaldo_*')

$ExcludeFiles = @(
    'generador-licencias.html',
    'id_equipo.txt',
    'github-repo-nombre.txt',
    'sanmy-taller-servidor.pid',
    'sanmy-taller-terminal-ip.txt',
    'SUBIR-A-GITHUB.bat',
    'CREAR-ICONO-GITHUB-ESCRITORIO.bat',
    'EMPAQUETAR-TALLER.bat',
    'GENERADOR-LICENCIAS.bat'
)

$ExcludeInstaladorFiles = @(
    'subir-github-taller.ps1',
    'crear-icono-github-escritorio.ps1'
)

function Test-ExcludedDir($name) {
    if ($ExcludeDirs -contains $name) { return $true }
    foreach ($pat in $ExcludeDirPatterns) {
        if ($name -like $pat) { return $true }
    }
    return $false
}

function Should-SkipFile($name) {
    foreach ($pat in $ExcludeFiles) {
        if ($name -ieq $pat) { return $true }
    }
    return $false
}

function Copy-ProjectFiles($dest) {
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null

    foreach ($item in Get-ChildItem -Path $Root -Force) {
        if ($item.PSIsContainer) {
            if (Test-ExcludedDir $item.Name) { continue }
            if ($item.Name -eq 'instalador') {
                $destInst = Join-Path $dest 'instalador'
                New-Item -ItemType Directory -Path $destInst -Force | Out-Null
                foreach ($f in Get-ChildItem -Path $item.FullName -File) {
                    if ($ExcludeInstaladorFiles -contains $f.Name) { continue }
                    Copy-Item -Path $f.FullName -Destination (Join-Path $destInst $f.Name) -Force
                }
                continue
            }
            Copy-Item -Path $item.FullName -Destination (Join-Path $dest $item.Name) -Recurse -Force
        }
        elseif (-not (Should-SkipFile $item.Name)) {
            Copy-Item -Path $item.FullName -Destination (Join-Path $dest $item.Name) -Force
        }
    }

    $dataDir = Join-Path $dest 'data'
    if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
}

function Install-PortableNodeTo($runtimeDir) {
    if (Test-Path (Join-Path $runtimeDir 'node.exe')) {
        Write-Host '  Node.js portable ya presente en el paquete.'
        return
    }

    $nodeVersion = '20.18.0'
    $zipName = "node-v$nodeVersion-win-x64.zip"
    $url = "https://nodejs.org/dist/v$nodeVersion/$zipName"
    $tempZip = Join-Path $env:TEMP "sanmy-taller-node-$nodeVersion.zip"
    $tempExtract = Join-Path $env:TEMP "sanmy-taller-node-extract"

    Write-Host "  Descargando Node.js $nodeVersion..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $tempZip -UseBasicParsing

    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

    $inner = Get-ChildItem $tempExtract -Directory | Select-Object -First 1
    if (-not $inner) { throw 'No se pudo extraer Node.js' }

    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $runtimeDir -Recurse -Force

    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host '  Node.js portable incluido.'
}

function Install-NpmInPackage($packageDir, $npmCmd) {
    Write-Host '  Instalando dependencias npm...'
    $proc = Start-Process -FilePath $npmCmd -ArgumentList @(
        'install', '--omit=dev', '--no-fund', '--no-audit'
    ) -WorkingDirectory $packageDir -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) { throw 'npm install fallo' }
}

Write-Host ''
Write-Host ' PREPARAR PAQUETE - Sanmy Taller (cliente)'
Write-Host ' ========================================='
Write-Host '  Excluye: herramientas-vendedor, generador-licencias, scripts GitHub'
Write-Host ''

Write-Host '[1/4] Copiando archivos...'
Copy-ProjectFiles $OutputDir

Write-Host '[2/4] Node.js portable...'
$runtimeDir = Join-Path $OutputDir 'runtime\node'
Install-PortableNodeTo $runtimeDir

if (-not $SkipNpm) {
    Write-Host '[3/4] npm install...'
    $npm = Join-Path $runtimeDir 'npm.cmd'
    if (-not (Test-Path $npm)) { throw 'npm.cmd no encontrado' }
    Install-NpmInPackage $OutputDir $npm
} else {
    Write-Host '[3/4] Omitiendo npm (SkipNpm).'
}

Write-Host '[4/4] Listo.'
Write-Host ''
Write-Host " Paquete en: $OutputDir"
Write-Host ''
