#!/bin/bash

# Script to build for iOS simulator and take iPad screenshots
echo "📱 Starting iPad screenshot process..."

# Build for simulator
echo "Building app for iOS simulator..."
eas build --platform ios --profile simulator --non-interactive

# Wait for build to complete and download
echo "⏳ Waiting for build to complete and download..."
# You'll need to manually download the build from the EAS dashboard

# Open the simulator with the right iPad device
echo "🚀 Opening iPad 13\" Pro simulator..."
xcrun simctl boot "iPad Pro (12.9-inch) (6th generation)"

# Install the downloaded simulator build (.app file)
# Replace path/to/your-app.app with the actual path after downloading
echo "📲 Installing app on simulator..."
xcrun simctl install booted path/to/your-app.app

# Launch the app
echo "▶️ Launching app..."
xcrun simctl launch booted com.parleyapp

# Take screenshots (adjust delay as needed)
echo "📸 Taking screenshots in 5 seconds..."
sleep 5

# Create screenshots directory
mkdir -p ./screenshots

# Take screenshots of each tab
for i in {1..5}; do
  echo "Taking screenshot $i..."
  xcrun simctl io booted screenshot "./screenshots/ipad-pro-screenshot-$i.png"
  
  # Navigate to next tab/screen
  # You may need to adjust these commands based on your app's UI
  xcrun simctl input booted tap 400 800
  sleep 2
done

echo "✅ Screenshots saved to ./screenshots directory!"
echo "You can now upload these to App Store Connect" 