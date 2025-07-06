FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/

# Install dependencies
RUN cd backend && npm install

# Copy backend source code
COPY backend/src ./backend/src

# Build TypeScript
RUN cd backend && npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["sh", "-c", "cd backend && npm start"]
