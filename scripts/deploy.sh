#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# B1 migration: the deploy entry point. Build the OpenNext Worker and publish it to
# Cloudflare Workers. This replaces the old `[deploy] run = ./scripts/start.sh`,
# which built the Worker and then only started `wrangler dev` — a local dev server
# that never published anything, so a "deploy" silently did nothing.
#
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment.
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set to deploy." >&2
  exit 1
fi

pnpm deploy
