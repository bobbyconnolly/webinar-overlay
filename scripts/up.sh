#!/usr/bin/env bash
# Wake the relay for a rehearsal or the webinar: re-enable ingress and pin one
# replica so there is no cold start while people are scanning the QR code.
#   bash scripts/up.sh
source "$(dirname "$0")/_common.sh"

az containerapp ingress enable -g "$RG" -n "$APP" --type external --target-port 8080 --transport auto -o none
az containerapp update -g "$RG" -n "$APP" --min-replicas 1 --max-replicas 1 -o none

FQDN=$(relay_fqdn)
printf 'waiting for relay'
for _ in $(seq 1 30); do
  if curl -fsS -m 5 "https://$FQDN/healthz" >/dev/null 2>&1; then
    echo; echo "relay UP: https://$FQDN"; exit 0
  fi
  printf '.'; sleep 3
done
echo; echo "relay did not answer yet: https://$FQDN/healthz"; exit 1
