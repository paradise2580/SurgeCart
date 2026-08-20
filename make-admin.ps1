# Promotes a registered user to ADMIN so the Admin + benchmark panel appears.
#
#   .\make-admin.ps1 your@email.com
#
# Log out and back in afterwards - the role is carried inside the JWT, so an
# existing session token won't reflect the change until you get a new one.

param([Parameter(Mandatory=$true)][string]$Email)

docker compose exec -T postgres psql -U postgres -d surgecart -c "UPDATE users SET role='ADMIN' WHERE email='$Email';"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  Done. Log out and log back in to pick up the new role." -ForegroundColor Green
    Write-Host ""
}
