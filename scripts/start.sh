#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# B1 migration: no custom Node server / Container. Build the OpenNext Worker and
# serve it locally with Cloudflare bindings via wrangler dev. For a real deploy use
# `pnpm deploy` (= opennextjs-cloudflare build && opennextjs-cloudflare deploy).
echo "Building the OpenNext Worker and starting wrangler dev..."
pnpm opennextjs-cloudflare build && pnpm wrangler dev
