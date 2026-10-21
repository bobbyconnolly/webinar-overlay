#!/usr/bin/env bash
# After the webinar: delete resource group $RG and EVERYTHING in it
# (container app, environment, registry, images). Nothing else is touched.
#   bash scripts/destroy.sh          # asks for confirmation
#   bash scripts/destroy.sh --yes    # no prompt
source "$(dirname "$0")/_common.sh"

if ! az group exists -n "$RG" | tr -d '\r' | grep -q true; then
  echo "resource group '$RG' does not exist; nothing to do"; exit 0
fi
echo "Resources in '$RG':"
az resource list -g "$RG" --query "[].{name:name,type:type}" -o table
echo
if [ "${1:-}" != "--yes" ]; then
  read -r -p "Type '$RG' to delete this resource group and everything in it: " ANSWER
  [ "$ANSWER" = "$RG" ] || { echo "aborted"; exit 1; }
fi
az group delete -n "$RG" --yes
echo "resource group '$RG' deleted. Remove VITE_RELAY_URL/VITE_RELAY_KEY from .env if you like."
