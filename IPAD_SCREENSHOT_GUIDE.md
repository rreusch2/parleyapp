# iPad Screenshots Guide for App Store Submission

## Quick Method (No Xcode Build Required)

### Step 1: Build for Simulator
```bash
# Build the app for iOS simulator
eas build --platform ios --profile simulator --non-interactive
```

### Step 2: Download and Install
1. When build completes, download the `.tar.gz` file from EAS dashboard
2. Extract the `.app` file from the archive
3. Open Xcode
4. Open the Simulator (Xcode → Open Developer Tool → Simulator)
5. Select iPad Pro 12.9" (6th gen) from Device menu
6. Drag and drop the extracted `.app` file onto the simulator window

### Step 3: Take Screenshots
1. Navigate through your app to the screens you want to capture
2. Take screenshots using Cmd+Shift+4, then Space, then click on simulator
3. Or use the Screenshot tool in Simulator menu: File → Screenshot

### Step 4: Upload to App Store Connect
1. Go to App Store Connect → Your App → App Store tab → Media section
2. Upload the iPad Pro screenshots in the 12.9" size category

## Fixing Xcode Build Issues

If you prefer building directly with Xcode, try these fixes for the PIF error:

1. Force quit all Xcode processes:
```bash
killall Xcode
killall com.apple.CoreSimulator.CoreSimulatorService
```

2. Delete derived data:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

3. Restart your Mac

4. Try building again with a clean build folder (Option+Cmd+Shift+K in Xcode)

## Alternative: Screenshot Services

If all else fails, consider these services:
- AppScreens (appscreens.io)
- Shotbot (shotbot.io)
- Screely (screely.com)

These services can generate App Store screenshots from your designs without requiring a simulator. 