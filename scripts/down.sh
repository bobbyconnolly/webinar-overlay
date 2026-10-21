#!/usr/bin/env bash
# Stop paying for compute: scale the relay to zero AND disable ingress so a
# reconnecting phone cannot wake it. The Container App, environment and
# registry stay (registry ~US$5/month); scripts/destroy.sh removes everything.
#   bash scripts/down.sh
source "$(dirname "$0")/_common.sh"

az containerapp update -g "$RG" -n "$APP" --min-replicas 0 --max-replicas 1 -o none
az containerapp ingress disable -g "$RG" -n "$APP" -o none
echo "relay DOWN: ingress disabled, min replicas 0. Overlay will show 'offline'."
