# Shared settings for the Azure scripts. Sourced, not executed.
# No secrets here. Everything the scripts create lives in resource group $RG.
set -euo pipefail

RG="webinar"
LOCATION="canadacentral" # Canada Central (Toronto): the students and the Seer are in eastern Canada (was westus2 until 2026-10-03)
APP="relay"             # Container App name
ENV_NAME="webinar-env"  # Container Apps environment (in $LOCATION; recreated in Canada Central 2026-10-03)
ACR_PREFIX="webinaracr" # registry name = prefix + random hex (must be globally unique)

# `az` on Windows prints CRLF; strip the CR when capturing values.
azq() { az "$@" | tr -d '\r'; }

relay_fqdn() {
  azq containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true
}
