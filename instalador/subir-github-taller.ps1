# Subir Sanmy Taller a GitHub — solo pegue el TOKEN (no el nombre del repo)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoOwner = 'fermoce1'
$repoName = 'software-taller'
$repoUrl = "https://github.com/$repoOwner/$repoName"
$usuario = $repoOwner

function Invoke-Git {
    param([string[]]$GitArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = @(& git @GitArgs 2>&1 | ForEach-Object { "$_" })
    $ErrorActionPreference = $prev
    return @{ Code = $LASTEXITCODE; Text = ($lines -join "`n").Trim() }
}

function EsTokenGitHub {
    param([string]$Texto)
    $t = ($Texto -replace '\s', '').Trim()
    return ($t -match '^ghp_[A-Za-z0-9]{20,}$' -or $t -match '^github_pat_[A-Za-z0-9_]{20,}$')
}

function New-GitHubRepo {
    param($Headers)
    $body = @{ name = $repoName; private = $false; auto_init = $false } | ConvertTo-Json
    return Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Headers $Headers -Method Post -Body $body -ContentType 'application/json'
}

Clear-Host
Write-Host ''
Write-Host '  SUBIR SANMY TALLER A GITHUB  (version 3.1)'
Write-Host '  ========================================'
Write-Host ''
Write-Host '  Repositorio fijo: software-taller'
Write-Host "  $repoUrl"
Write-Host ''
Write-Host '  PASO 1 — Cree token (clasico, permiso repo):'
Write-Host '  https://github.com/settings/tokens/new?scopes=repo&description=Sanmy+Taller'
Write-Host ''
Write-Host '  PASO 2 — Pegue SOLO el token aqui abajo (empieza con ghp_...)'
Write-Host '  NO pegue el token en ningun otro campo.'
Write-Host ''

$token = Read-Host '  Pegue su token de GitHub'
$token = ($token -replace '\s', '').Trim()

if (-not $token) {
    Write-Host ''
    Write-Host '  No escribio ningun token.' -ForegroundColor Yellow
    Read-Host '  Pulse Enter para cerrar'
    exit 1
}

if (-not (EsTokenGitHub $token)) {
    Write-Host ''
    Write-Host '  Eso no parece un token valido (debe empezar con ghp_).' -ForegroundColor Red
    Write-Host '  Copielo de nuevo desde GitHub.' -ForegroundColor Yellow
    Read-Host '  Pulse Enter para cerrar'
    exit 1
}

Set-Location $root

Write-Host ''
Write-Host '  Verificando token...'

$headers = @{
    Authorization = "Bearer $token"
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'Sanmy-Taller-Subir'
}

try {
    $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers -Method Get
    Write-Host "  Cuenta: $($me.login)" -ForegroundColor Cyan
    if ($me.login -ne $usuario) {
        Write-Host "  ERROR: Token de otra cuenta (@$($me.login))." -ForegroundColor Red
        Read-Host '  Pulse Enter para cerrar'
        exit 1
    }
} catch {
    Write-Host '  ERROR: Token invalido o expirado.' -ForegroundColor Red
    Read-Host '  Pulse Enter para cerrar'
    exit 1
}

$pushUrl = "https://${usuario}:$token@github.com/${repoOwner}/${repoName}.git"
$cleanUrl = "https://github.com/${repoOwner}/${repoName}.git"

function Hacer-Push {
    Invoke-Git -GitArgs @('remote', 'set-url', 'origin', $pushUrl) | Out-Null
    $result = Invoke-Git -GitArgs @('push', '-u', 'origin', 'main')
    if ($result.Code -ne 0 -and $result.Text -match 'rejected|fetch first|non-fast-forward') {
        Write-Host '  Integrando cambios del remoto...' -ForegroundColor Yellow
        $pull = Invoke-Git -GitArgs @('pull', 'origin', 'main', '--rebase', '--allow-unrelated-histories', '--no-edit')
        if ($pull.Code -eq 0) { $result = Invoke-Git -GitArgs @('push', '-u', 'origin', 'main') }
    }
    Invoke-Git -GitArgs @('remote', 'set-url', 'origin', $cleanUrl) | Out-Null
    return $result
}

Write-Host ''
Write-Host '  Subiendo codigo (no se detiene si el repo no existe aun)...'
Write-Host ''

$push = Hacer-Push

if ($push.Code -ne 0 -and $push.Text -match 'not found|does not exist|Could not read') {
    Write-Host ''
    Write-Host '  software-taller no existe todavia en GitHub.' -ForegroundColor Yellow
    $crear = Read-Host '  ¿Crearlo ahora y subir codigo? (S/N)'
    if ($crear -match '^[sS]') {
        Write-Host '  Creando repositorio...'
        try {
            $n = New-GitHubRepo -Headers $headers
            Write-Host "  Creado: $($n.html_url)" -ForegroundColor Green
        } catch {
            Write-Host '  (Puede que ya exista, reintentando subir...)' -ForegroundColor Yellow
        }
        $push = Hacer-Push
    }
}

if ($push.Code -ne 0) {
    Write-Host '  ERROR al subir:' -ForegroundColor Red
    Write-Host $push.Text -ForegroundColor Red
    Write-Host ''
    Write-Host '  Cree el repo vacio aqui y vuelva a ejecutar:' -ForegroundColor Yellow
    Write-Host '  https://github.com/new?name=software-taller'
} else {
    Write-Host '  LISTO — codigo subido correctamente.' -ForegroundColor Green
    if ($push.Text) { Write-Host $push.Text }
    Write-Host ''
    Write-Host "  Ver en: $repoUrl"
}

$token = $null
$pushUrl = $null

Write-Host ''
Read-Host '  Pulse Enter para cerrar'
