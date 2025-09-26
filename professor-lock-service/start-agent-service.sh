#!/bin/bash

# Start Professor Lock Advanced - Agent + WebSocket Service
echo "🚀 Starting Professor Lock Advanced Service..."

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down services..."
    kill $AGENT_PID $WEBSOCKET_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start the OpenManus agent API server in the background
echo "🧠 Starting OpenManus agent API server..."
cd /home/reid/Desktop/parleyapp
python agent-api-server.py &
AGENT_PID=$!

# Wait for agent to start
echo "⏳ Waiting for agent to initialize..."
sleep 5

# Check if agent is running
if ! curl -f http://localhost:3003/health >/dev/null 2>&1; then
    echo "❌ OpenManus agent failed to start"
    kill $AGENT_PID 2>/dev/null
    exit 1
fi

echo "✅ OpenManus agent running on port 3003"

# Start the WebSocket service
echo "🔌 Starting WebSocket service..."
cd /home/reid/Desktop/parleyapp/professor-lock-service
npm start &
WEBSOCKET_PID=$!

# Wait for WebSocket service to start
sleep 3

# Check if WebSocket service is running
if ! curl -f http://localhost:8081/health >/dev/null 2>&1; then
    echo "❌ WebSocket service failed to start"
    cleanup
    exit 1
fi

echo "✅ WebSocket service running on port 8081"
echo ""
echo "🎉 Professor Lock Advanced is ready!"
echo "   • Agent API: http://localhost:3003"
echo "   • WebSocket: ws://localhost:8081/professor-lock/{userId}"
echo "   • Health check: http://localhost:8081/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running and wait for both processes
wait $AGENT_PID $WEBSOCKET_PID
