param(
    [int]$Port = 3020
)

$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
exit 0
