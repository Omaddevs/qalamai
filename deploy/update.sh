#!/usr/bin/env bash
# Pull the latest main from GitHub and rebuild QalamAI on the server: `bash /opt/qalamai/deploy/update.sh`
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only origin main
cd deploy
docker compose up -d --build
# nginx resolves the api container's address once at start; a recreated api gets a new one
docker compose restart web >/dev/null
docker image prune -f >/dev/null
sleep 10
docker compose ps --format '{{.Name}} {{.Status}}'
curl -fsS -o /dev/null -w 'web: %{http_code}\n' http://172.18.0.1:8094/
curl -fsS -o /dev/null -w 'api: %{http_code}\n' http://172.18.0.1:8094/api/v1/plans
echo "deployed $(git rev-parse --short HEAD)"
