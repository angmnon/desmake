#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

# H5: run the production server in production mode. Without COZE_PROJECT_ENV=PROD
# the custom server (src/server.ts) falls back to `next dev`, discarding the
# prebuilt `.next` output and exposing source/stack traces.
export COZE_PROJECT_ENV=PROD
export NODE_ENV=production

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"


start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    PORT=${DEPLOY_RUN_PORT} node dist/server.js
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
