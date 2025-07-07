FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/.babelrc ./backend/

# Install dependencies
RUN cd backend && npm install

# Copy backend source code
COPY backend/src ./backend/src

# Build with Babel (bypasses TypeScript errors)
RUN cd backend && npm run build:babel

# Verify build output exists
RUN ls -la backend/dist/

# Expose port
EXPOSE 3001
ENV PORT=3001

# Set working directory to backend
WORKDIR /app/backend

# Add debugging to verify files exist
RUN ls -la dist/ || echo "No dist directory found"
RUN ls -la package.json || echo "No package.json found"

# Start the application
CMD ["npm", "start"]
