#!/usr/bin/env bash
# Promotes a registered user to ADMIN.  ./make-admin.sh your@email.com
# Log out and back in afterwards - the role lives inside the JWT.
set -e
[ -z "$1" ] && { echo "Usage: ./make-admin.sh your@email.com"; exit 1; }
docker compose exec -T postgres psql -U postgres -d surgecart \
  -c "UPDATE users SET role='ADMIN' WHERE email='$1';"
echo ""
echo "  Done. Log out and log back in to pick up the new role."
echo ""
