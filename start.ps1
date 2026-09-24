# SurgeCart - one-command local startup (Windows PowerShell)
#
#   .\start.ps1          normal start
#   .\start.ps1 -Fresh   wipe all data and start clean
#
# Requires: Docker Desktop running. Nothing else.

param([switch]$Fresh)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  SurgeCart - Flash Sale Reservation Engine" -ForegroundColor Cyan
Write-Host ""

# Fail early with a clear message rather than a confusing docker error
try { docker info *> $null } catch {
    Write-Host "  Docker doesn't appear to be running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

if ($Fresh) {
    Write-Host "  Removing existing containers and volumes..." -ForegroundColor Yellow
    docker compose down -v
}

Write-Host "  Building and starting all services (first run takes a few minutes)..." -ForegroundColor Yellow
Write-Host ""
docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  Build failed. Full logs:  docker compose logs" -ForegroundColor Red
    exit 1
}

# Spring Boot needs ~20s after the container starts before it serves traffic,
# so poll the actuator endpoint rather than reporting success too early.
Write-Host "  Waiting for the API to become healthy..." -ForegroundColor Yellow
$ready = $false
foreach ($i in 1..60) {
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:8080/actuator/health" -TimeoutSec 2
        if ($r.status -eq "UP") { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}

Write-Host ""
if ($ready) {
    Write-Host "  Everything is up." -ForegroundColor Green
} else {
    Write-Host "  API didn't report healthy in 120s. Check:  docker compose logs core-api" -ForegroundColor Red
}

Write-Host ""
Write-Host "    App        http://localhost:4200"
Write-Host "    Swagger    http://localhost:8080/swagger-ui.html"
Write-Host "    Gateway    http://localhost:8081/health"
Write-Host ""
Write-Host "  Register an account at http://localhost:4200/register" -ForegroundColor Cyan
Write-Host "  Then, to unlock the Admin + benchmark panel:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    .\scripts\make-admin.ps1 your@email.com"
Write-Host ""
Write-Host "  Stop with:  docker compose down"
Write-Host ""
