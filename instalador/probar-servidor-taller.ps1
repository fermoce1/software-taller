param(
    [int]$Port = 3020,
    [int]$TimeoutSec = 3
)

$url = "http://127.0.0.1:$Port/api/health"
try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSec
    if ($r.StatusCode -eq 200 -and $r.Content -match 'Sanmy Taller') {
        exit 0
    }
} catch {
    exit 1
}
exit 1
