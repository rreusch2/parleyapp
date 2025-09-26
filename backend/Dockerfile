FROM node:20-bookworm-slim AS builder

# Set working directory to the backend application directory
WORKDIR /app/backend

# Install build dependencies (node-gyp toolchain)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy package files and install dev dependencies for build
COPY package*.json ./
RUN npm ci

# Copy TypeScript config, babel config, and source files
COPY tsconfig.json ./
COPY .babelrc ./
COPY src ./src

# Build TypeScript/Babel application
RUN npm run build:babel

# -------- Runtime image --------
FROM node:20-bookworm-slim AS runner

WORKDIR /app/backend
ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts and start script
COPY --from=builder /app/backend/dist ./dist
COPY start.js ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run the application directly
CMD ["node", "dist/index.js"]

