param(
    [int]$Port = 3000,
    [int]$TimeoutSec = 45
)

$url = "http://127.0.0.1:$Port/api/health"
$deadline = (Get-Date).AddSeconds($TimeoutSec)

while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) {
            exit 0
        }
    } catch {
        Start-Sleep -Milliseconds 800
    }
}

Write-Host "TIMEOUT: el servidor no respondio en $TimeoutSec segundos."
exit 1
