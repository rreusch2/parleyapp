FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/

# Install dependencies
RUN cd backend && npm install

# Copy backend source code and other necessary files
COPY backend/src ./backend/src
COPY backend/.env ./backend/.env

# Build TypeScript
RUN cd backend && npm run build

# Verify build output exists
RUN ls -la backend/dist/

# Expose port
EXPOSE 3000

# Set working directory to backend
WORKDIR /app/backend

# Start the application
CMD ["npm", "start"]
