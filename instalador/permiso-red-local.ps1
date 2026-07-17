# Permite Sanmy Taller (puerto 3020) en TODOS los perfiles de red (Domain, Private, Public).
# Necesario cuando la WiFi aparece como Public; no abre el puerto a Internet por si solo.
# Ejecutar como Administrador.
param([int]$Port = 3020)

$ruleName = "Sanmy Taller $Port"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Direction Inbound -Action Allow -Profile Any | Out-Null
    Write-Host "Regla de firewall actualizada: $ruleName (Domain + Private + Public)"
    exit 0
}

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $Port `
    -Action Allow `
    -Profile Any `
    -Description "Sanmy Taller - acceso inbound TCP desde la red local (todos los perfiles)" | Out-Null

Write-Host "Listo: puerto $Port permitido en Domain, Private y Public."
