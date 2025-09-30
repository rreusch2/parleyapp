#!/bin/bash
set -e

# Substitute environment variables in config.toml
CONFIG_FILE="/app/OpenManus/config/config.toml"

echo "Substituting environment variables in config..."

# Replace ${VAR} with actual environment variable values
envsubst < "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "Config ready. Starting uvicorn..."

# Start the service
exec uvicorn service.server:app --host 0.0.0.0 --port 8000
