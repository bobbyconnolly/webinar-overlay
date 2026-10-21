#!/usr/bin/env bash
# Show what exists in resource group $RG and whether the relay answers.
#   bash scripts/status.sh
source "$(dirname "$0")/_common.sh"

if ! az group exists -n "$RG" | tr -d '\r' | grep -q true; then
  echo "resource group '$RG' does not exist"; exit 0
fi
az resource list -g "$RG" --query "[].{name:name,resourceType:type,location:location}" -o table
echo
FQDN=$(relay_fqdn)
if [ -z "$FQDN" ]; then echo "relay: no ingress (down) or not deployed"; exit 0; fi
MIN=$(azq containerapp show -g "$RG" -n "$APP" --query properties.template.scale.minReplicas -o tsv)
RUNNING=$(azq containerapp replica list -g "$RG" -n "$APP" --query "length(@)" -o tsv 2>/dev/null || echo "?")
echo "relay URL     : https://$FQDN"
echo "min replicas  : ${MIN:-0}   running replicas: $RUNNING"
printf 'health        : '; curl -fsS -m 10 "https://$FQDN/healthz" 2>/dev/null || printf 'no answer'; echo
