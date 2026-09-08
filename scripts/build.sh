#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# B1 migration: no custom Node server / tsup step. The OpenNext Cloudflare adapter
# (`opennextjs-cloudflare build`) invokes this `build` script (next build) and then
# transforms the output into .open-next/ for Cloudflare Workers.
# B1 migration: inline blog markdown (no node:fs at Worker runtime) before building.
node scripts/gen-blog-content.mjs

echo "Building the Next.js project..."
pnpm next build

echo "Build completed successfully!"
