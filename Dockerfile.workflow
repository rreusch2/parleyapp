FROM node:18-alpine

# Install additional tools needed for the workflow
RUN apk add --no-cache \
    curl \
    bash \
    dcron \
    tzdata \
    jq \
    git

# Set timezone
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy TypeScript config and build backend
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
RUN cd backend && npm run build

# Copy workflow scripts
COPY scripts/ ./scripts/
COPY test-orchestrator-integration.sh ./

# Make scripts executable
RUN chmod +x ./scripts/*.sh
RUN chmod +x ./test-orchestrator-integration.sh

# Create cron job file
RUN echo "0 2 * * * /app/scripts/daily-automated-workflow.sh >> /app/workflow-logs/cron.log 2>&1" > /etc/crontabs/root

# Create start script
RUN cat > /app/scripts/start-cron.sh << 'EOF'
#!/bin/bash
echo "Starting cron daemon for ParleyApp daily workflow..."

# Create log directories
mkdir -p /app/logs/daily-workflow
mkdir -p /app/workflow-logs

# Start cron in foreground
exec crond -f -l 2
EOF

RUN chmod +x /app/scripts/start-cron.sh

# Health check
HEALTHCHECK --interval=1h --timeout=30s --start-period=60s --retries=3 \
  CMD test -f /app/workflow-logs/cron.log && echo "Cron service running"

CMD ["/app/scripts/start-cron.sh"] 