# Crea acceso directo en el escritorio: "Subir Sanmy Taller a GitHub"
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bat = Join-Path $root 'SUBIR-A-GITHUB.bat'
$ico = Join-Path $root 'sanmy-taller.ico'

if (-not (Test-Path $bat)) {
    throw "No se encuentra SUBIR-A-GITHUB.bat en $root"
}

function Get-DesktopPaths {
    $paths = @()
    $paths += [Environment]::GetFolderPath('Desktop')
    $profile = $env:USERPROFILE
    foreach ($sub in @('Desktop', 'OneDrive\Desktop', 'OneDrive - Personal\Desktop')) {
        $p = Join-Path $profile $sub
        if ((Test-Path $p) -and ($paths -notcontains $p)) { $paths += $p }
    }
    return $paths
}

$wsh = New-Object -ComObject WScript.Shell
$iconLoc = if (Test-Path $ico) { "$ico,0" } else { $null }
$nombre = 'Subir Sanmy Taller a GitHub.lnk'

foreach ($desktop in (Get-DesktopPaths)) {
    $lnk = Join-Path $desktop $nombre
    $s = $wsh.CreateShortcut($lnk)
    $s.TargetPath = $bat
    $s.WorkingDirectory = $root
    $s.Description = 'Pegar token de GitHub y subir respaldo del taller'
    $s.WindowStyle = 1
    if ($iconLoc) { $s.IconLocation = $iconLoc }
    $s.Save()
    Write-Host "Acceso creado: $lnk"
}

Write-Host ''
Write-Host 'Listo. En el escritorio verá: Subir Sanmy Taller a GitHub'
