#!/usr/bin/env bash
#
# Build the webgl-sleeve example and publish it to surge.sh under the
# anonymous review domain gjs-sleeve.surge.sh.
#
# Prerequisites:
#   - surge CLI installed (`npm install -g surge`)
#   - Authenticated once with `surge login` (the email/password is cached in
#     ~/.netrc and reused on every run). To override on CI, set SURGE_LOGIN
#     and SURGE_TOKEN — surge will pick them up automatically.
#
# Usage:
#   ./deploy-webgl-sleeve.sh             # full build + deploy
#   ./deploy-webgl-sleeve.sh --skip-build # deploy whatever is already built
#
# Outputs the live URL at the end:
#   https://gjs-sleeve.surge.sh
#
set -euo pipefail

DOMAIN="gjs-sleeve.surge.sh"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$ROOT/examples/webgl-sleeve"
PUBLISH_DIR="$ROOT/website/static/webgl-sleeve"

skip_build=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) skip_build=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if ! command -v surge >/dev/null 2>&1; then
  echo "Error: surge CLI not found. Install with: npm install -g surge" >&2
  exit 1
fi

# Confirm a surge identity is available (env-var creds or cached login).
if [[ -z "${SURGE_LOGIN:-}" || -z "${SURGE_TOKEN:-}" ]]; then
  if ! surge whoami >/dev/null 2>&1; then
    echo "Error: surge is not logged in. Run 'surge login' first, or export" >&2
    echo "       SURGE_LOGIN and SURGE_TOKEN before invoking this script." >&2
    exit 1
  fi
fi

if [[ "$skip_build" -eq 0 ]]; then
  echo "==> Building webgl-sleeve example..."
  (cd "$EXAMPLE_DIR" && npm run build)
fi

if [[ ! -f "$PUBLISH_DIR/index.html" ]]; then
  echo "Error: $PUBLISH_DIR/index.html not found. Run without --skip-build." >&2
  exit 1
fi

echo "==> Deploying $PUBLISH_DIR to https://$DOMAIN ..."
surge "$PUBLISH_DIR" "$DOMAIN"

echo
echo "Done. Live at: https://$DOMAIN"
