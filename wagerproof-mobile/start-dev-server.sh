#!/bin/bash

# Start Expo dev server and show connection info
cd "$(dirname "$0")"

echo "🚀 Starting Expo Dev Server..."
echo ""

# Kill any existing Expo processes
pkill -f "expo start" 2>/dev/null || true
sleep 1

# Start the server
npx expo start --lan --clear

