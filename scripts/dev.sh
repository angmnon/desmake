#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# B1 migration: no custom Node server. `next dev` runs the app with the OpenNext
# Cloudflare dev shim (enabled via initOpenNextCloudflareForDev() in next.config.ts),
# so server code resolves the native D1/R2 bindings from .dev.vars locally.
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-${PORT}}"

# B1 migration: inline blog markdown (no node:fs at Worker runtime) before starting dev.
node scripts/gen-blog-content.mjs

echo "Starting Next.js dev server on port ${DEPLOY_RUN_PORT}..."
PORT=${DEPLOY_RUN_PORT} pnpm next dev
