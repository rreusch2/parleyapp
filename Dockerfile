FROM node:18-alpine

# Set working directory to the backend application directory
WORKDIR /app/backend

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY backend/package*.json ./
RUN npm ci

# Copy TypeScript config, babel config, and source files
COPY backend/tsconfig.json ./
COPY backend/.babelrc ./
COPY backend/src ./src

# Build TypeScript application
RUN npm run build:babel

# Copy our robust startup script
COPY backend/start.js ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run the application directly
CMD ["node", "dist/index.js"]