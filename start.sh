#!/usr/bin/env bash
# SurgeCart - one-command local startup (macOS / Linux)
#   ./start.sh           normal start
#   ./start.sh --fresh   wipe all data and start clean
set -e

echo ""
echo "  SurgeCart - Flash Sale Reservation Engine"
echo ""

if ! docker info >/dev/null 2>&1; then
  echo "  Docker doesn't appear to be running. Start it and try again."
  exit 1
fi

if [ "$1" == "--fresh" ]; then
  echo "  Removing existing containers and volumes..."
  docker compose down -v
fi

echo "  Building and starting all services (first run takes a few minutes)..."
docker compose up --build -d

echo "  Waiting for the API to become healthy..."
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8080/actuator/health | grep -q '"status":"UP"'; then
    echo ""
    echo "  Everything is up."
    break
  fi
  sleep 2
done

cat <<'INFO'

    App        http://localhost:4200
    Swagger    http://localhost:8080/swagger-ui.html
    Gateway    http://localhost:8081/health

  Register at http://localhost:4200/register, then to unlock the Admin panel:

    ./scripts/make-admin.sh your@email.com

  Stop with:  docker compose down

INFO
