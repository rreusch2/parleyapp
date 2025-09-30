#!/bin/bash
set -e

# Substitute environment variables in config.toml
CONFIG_FILE="/app/OpenManus/config/config.toml"

echo "Substituting environment variables in config..."
echo "DAYTONA_API_KEY is set: ${DAYTONA_API_KEY:+yes}"
echo "OPENAI_API_KEY is set: ${OPENAI_API_KEY:+yes}"

# Export variables that envsubst should replace
export DAYTONA_API_KEY
export OPENAI_API_KEY
export ANTHROPIC_API_KEY

# Replace ${VAR} with actual environment variable values
envsubst '${DAYTONA_API_KEY} ${OPENAI_API_KEY} ${ANTHROPIC_API_KEY}' < "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "Config substitution complete. Starting uvicorn..."

# Start the service
cd /app/OpenManus
exec uvicorn service.server:app --host 0.0.0.0 --port 8000
