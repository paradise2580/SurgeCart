# Promotes a registered user to ADMIN so the Admin + benchmark panel appears.
#
#   .\scripts\make-admin.ps1 your@email.com
#
# Log out and back in afterwards - the role is carried inside the JWT, so an
# existing session token won't reflect the change until you get a new one.

param([Parameter(Mandatory=$true)][string]$Email)

# docker compose needs to run next to docker-compose.yml, one level up.
Push-Location (Join-Path $PSScriptRoot "..")

docker compose exec -T postgres psql -U postgres -d surgecart -c "UPDATE users SET role='ADMIN' WHERE email='$Email';"
Pop-Location

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  Done. Log out and log back in to pick up the new role." -ForegroundColor Green
    Write-Host ""
}
