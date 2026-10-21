#!/usr/bin/env bash
# Deploy (or redeploy) the relay to Azure Container Apps.
#
#   bash scripts/deploy.sh             # keeps the desktop key in .env: no overlay restart needed
#   bash scripts/deploy.sh --new-key   # rotates the key (then restart npm run tauri dev)
#
# What it does, all inside resource group $RG:
#   1. resource group                       (webinar, West US 2)
#   2. container registry, Basic SKU        (~US$5/month while it exists)
#   3. cloud build of the image from the repo root (az acr build: no local Docker)
#   4. Container Apps environment           (no Log Analytics: fewer resources)
#   5. Container App: external HTTPS/WSS ingress, 1 replica max (rooms live in
#      memory), scale-to-zero when idle
# Then prints the public URL and writes VITE_RELAY_URL / VITE_RELAY_KEY into
# ./.env (git-ignored). Idempotent: run again after changing relay/ code.
source "$(dirname "$0")/_common.sh"
cd "$(dirname "$0")/.."
NEW_KEY=0
for arg in "$@"; do
  case "$arg" in
    --new-key) NEW_KEY=1 ;;
    *) echo "unknown option: $arg (only --new-key)"; exit 2 ;;
  esac
done

echo "== resource group $RG"
# A resource group's own location is only metadata and cannot change; the resources inside
# go to $LOCATION. Create it once, never "create" it again (az refuses a different location).
if az group exists -n "$RG" | tr -d '' | grep -q true; then
  echo "   exists"
else
  az group create -n "$RG" -l "$LOCATION" -o none
fi

echo "== container registry"
ACR=$(azq acr list -g "$RG" --query "[0].name" -o tsv)
if [ -z "$ACR" ]; then
  ACR="${ACR_PREFIX}$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  az acr create -g "$RG" -n "$ACR" --sku Basic --admin-enabled true -o none
fi
echo "   $ACR"

echo "== building image in Azure from the repo root (this takes 1-2 minutes)"
TAG=$(date +%Y%m%d%H%M%S)
IMAGE="$ACR.azurecr.io/relay:$TAG"
az acr build -r "$ACR" -t "relay:$TAG" -f relay/Dockerfile . -o none

echo "== container apps environment $ENV_NAME"
if ! az containerapp env show -g "$RG" -n "$ENV_NAME" -o none 2>/dev/null; then
  az containerapp env create -g "$RG" -n "$ENV_NAME" -l "$LOCATION" --logs-destination none -o none
fi

# Desktop key: only sockets presenting it may act as the presenter's overlay.
# Reused from .env if already there (so the running overlay stays connected across
# deploys), generated when missing or on --new-key.
KEY=$(grep -E '^VITE_RELAY_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)
if [ -z "$KEY" ] || [ "$NEW_KEY" = 1 ]; then
  KEY=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
  KEY_NOTE="new desktop key: restart 'npm run tauri dev' to pick it up"
else
  KEY_NOTE="desktop key unchanged: the running overlay stays connected"
fi

echo "== container app $APP"
if az containerapp show -g "$RG" -n "$APP" -o none 2>/dev/null; then
  az containerapp secret set -g "$RG" -n "$APP" --secrets "desktop-key=$KEY" -o none
  az containerapp update -g "$RG" -n "$APP" --image "$IMAGE" \
    --set-env-vars "RELAY_DESKTOP_KEY=secretref:desktop-key" "PORT=8080" -o none
else
  ACR_USER=$(azq acr credential show -n "$ACR" --query username -o tsv)
  ACR_PASS=$(azq acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)
  az containerapp create -g "$RG" -n "$APP" --environment "$ENV_NAME" --image "$IMAGE" \
    --registry-server "$ACR.azurecr.io" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --secrets "desktop-key=$KEY" \
    --env-vars "RELAY_DESKTOP_KEY=secretref:desktop-key" "PORT=8080" \
    --ingress external --target-port 8080 --transport auto \
    --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi -o none
fi

FQDN=$(relay_fqdn)
URL="https://$FQDN"

# Write the two values the overlay needs into .env (git-ignored), in ONE write:
# Vite restarts on every .env change and can miss a second write that follows
# the first within milliseconds. (No `touch`: it bumped the mtime on every deploy
# and restarted Vite for nothing.)
[ -f .env ] || : > .env
{
  grep -vE '^(VITE_RELAY_URL|VITE_RELAY_KEY)=' .env || true
  echo "VITE_RELAY_URL=$URL"
  echo "VITE_RELAY_KEY=$KEY"
} > .env.tmp
if cmp -s .env.tmp .env; then
  rm .env.tmp   # unchanged: leave the mtime alone so Vite does not restart
  ENV_NOTE=".env unchanged"
else
  mv .env.tmp .env
  ENV_NOTE=".env updated (Vite reloads it)"
fi

echo
echo "Relay URL : $URL"
echo "Health    : $URL/healthz"
echo "$ENV_NOTE · $KEY_NOTE"
echo "Smoke test: node relay/smoke.mjs $URL \"\$VITE_RELAY_KEY\""
