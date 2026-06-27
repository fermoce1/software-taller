# Icono Sanmy Taller en escritorio e Inicio
param([string]$InstallDir = '')

$ErrorActionPreference = 'Stop'
$root = if ($InstallDir) { (Resolve-Path $InstallDir).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$vbs = Join-Path $root 'Sanmy-Taller.vbs'
$batFallback = Join-Path $root 'ABRIR-SISTEMA.bat'
$ico = Join-Path $root 'sanmy-taller.ico'

$usarVbs = Test-Path $vbs
if (-not $usarVbs -and -not (Test-Path $batFallback)) {
    throw "No se encuentra Sanmy-Taller.vbs ni ABRIR-SISTEMA.bat en $root"
}

function Ensure-TallerIcon {
    param([string]$IcoPath)

    Add-Type -AssemblyName System.Drawing
    $size = 256
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(30, 58, 95))

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($size, $size),
        [System.Drawing.Color]::FromArgb(30, 58, 95),
        [System.Drawing.Color]::FromArgb(37, 99, 235)
    )
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $light = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(219, 234, 254))

    # Llave inglesa (forma simple)
    $g.FillEllipse($white, 48, 48, 88, 88)
    $g.FillRectangle($white, 108, 88, 120, 36)
    $g.FillEllipse($light, 64, 64, 56, 56)
    $g.FillRectangle($light, 120, 96, 96, 20)

    $fontStyle = [System.Drawing.FontStyle]::Bold
    $font = New-Object System.Drawing.Font('Segoe UI', 44, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString('T', $font, $white, 78, 58)

    $handle = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($handle)
    try {
        $stream = [System.IO.File]::Create($IcoPath)
        try { $icon.Save($stream) } finally { $stream.Close() }
        Write-Host "Icono .ico listo: $IcoPath"
    } finally {
        $icon.Dispose()
        $bmp.Dispose()
        $g.Dispose()
        $bgBrush.Dispose()
        $white.Dispose()
        $light.Dispose()
        $font.Dispose()
    }
}

if (-not (Test-Path $ico)) {
    Ensure-TallerIcon -IcoPath $ico
}

function Get-DesktopPaths {
    $paths = @()
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($cs -and $cs.UserName) {
        $user = ($cs.UserName -split '\\')[-1]
        $profile = Join-Path 'C:\Users' $user
        foreach ($sub in @('Desktop', 'OneDrive\Desktop', 'OneDrive - Personal\Desktop')) {
            $p = Join-Path $profile $sub
            if (Test-Path $p) { $paths += $p }
        }
        $script:Programs = Join-Path $profile 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'
    }
    $paths += Join-Path $env:USERPROFILE 'Desktop'
    return ($paths | Where-Object { Test-Path $_ } | Select-Object -Unique)
}

if ($usarVbs) {
    $cmd = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $argLine = '"' + $vbs + '"'
} else {
    $cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
    $argLine = '/c "' + $batFallback + '"'
}
$wsh = New-Object -ComObject WScript.Shell
$iconLoc = if (Test-Path $ico) { "$ico,0" } else { $null }

foreach ($desktop in (Get-DesktopPaths)) {
    $lnk = Join-Path $desktop 'Sanmy Taller.lnk'
    $s = $wsh.CreateShortcut($lnk)
    $s.TargetPath = $cmd
    $s.Arguments = $argLine
    $s.WorkingDirectory = $root
    $s.Description = 'Sanmy Taller Mecánico — órdenes y vehículos'
    $s.WindowStyle = 7
    if ($iconLoc) { $s.IconLocation = $iconLoc }
    $s.Save()
    Write-Host "Icono en escritorio: $lnk"
}

$programs = if ($script:Programs -and (Test-Path $script:Programs)) { $script:Programs } else { Join-Path ([Environment]::GetFolderPath('Programs')) }
$folder = Join-Path $programs 'Sanmy Taller'
if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
$s2 = $wsh.CreateShortcut((Join-Path $folder 'Sanmy Taller.lnk'))
$s2.TargetPath = $cmd
$s2.Arguments = $argLine
$s2.WorkingDirectory = $root
$s2.Description = 'Sanmy Taller Mecánico'
$s2.WindowStyle = 7
if ($iconLoc) { $s2.IconLocation = $iconLoc }
$s2.Save()
Write-Host "Menu Inicio: $(Join-Path $folder 'Sanmy Taller.lnk')"
