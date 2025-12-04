# Dev Build Troubleshooting Guide

## "There was a problem loading the project" Error

This error typically occurs when your phone can't connect to the Metro bundler running on your computer.

## Quick Fixes

### 1. Use Tunnel Mode (Recommended for Phone Testing)

Tunnel mode works even if your phone and computer are on different networks:

```bash
cd wagerproof-mobile
npx expo start --tunnel
```

This creates a secure tunnel through ngrok that your phone can access from anywhere.

### 2. Ensure Same Network (LAN Mode)

If using LAN mode, make sure:
- Phone and computer are on the **same Wi-Fi network**
- Firewall isn't blocking port 8081
- Your router allows device-to-device communication

```bash
cd wagerproof-mobile
npx expo start --lan
```

### 3. Check Your Computer's IP Address

Your phone needs to connect to your computer's local IP. Find it:

**Mac/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```

Look for your local network IP (usually starts with 192.168.x.x or 10.0.x.x)

### 4. Clear Cache and Rebuild

```bash
cd wagerproof-mobile
# Clear Expo cache
rm -rf .expo node_modules/.cache

# Clear Metro bundler cache
npx expo start --clear
```

### 5. Rebuild the Dev Client

If you've made changes to native modules or configuration:

**Android:**
```bash
cd wagerproof-mobile
npx expo run:android
```

This rebuilds the dev client with the latest configuration.

### 6. Check Firewall Settings

**Mac:**
- System Settings → Network → Firewall
- Make sure Metro bundler/Node.js is allowed

**Windows:**
- Windows Defender Firewall → Allow an app
- Make sure Node.js is allowed for private networks

### 7. Verify Dev Server is Running

When you run `npx expo start`, you should see:
- A QR code in the terminal
- A URL like `exp://192.168.x.x:8081` or `exp://xxx.xxx.ngrok.io`
- Metro bundler logs

If you don't see these, the server isn't running properly.

## Step-by-Step Debugging

1. **Start the dev server:**
   ```bash
   cd wagerproof-mobile
   npx expo start --tunnel
   ```

2. **Note the connection URL** shown in the terminal (should start with `exp://`)

3. **On your phone**, open the dev client app and:
   - Tap "Enter URL manually" or similar
   - Enter the URL from step 2
   - Or scan the QR code if available

4. **Check the terminal** for any error messages

5. **Check your phone's network** - make sure it has internet access

## Common Issues

### Issue: "Unable to resolve module"
**Solution:** Clear cache and reinstall dependencies
```bash
rm -rf node_modules .expo
npm install
npx expo start --clear
```

### Issue: "Network request failed"
**Solution:** Use tunnel mode or check firewall
```bash
npx expo start --tunnel
```

### Issue: "Metro bundler has encountered an error"
**Solution:** Check for syntax errors in your code, clear cache
```bash
npx expo start --clear
```

### Issue: App builds but shows blank screen
**Solution:** Check console logs, verify entry point is correct
- Entry point should be `expo-router/entry` (already configured)
- Make sure `app/_layout.tsx` exists and is valid

## Still Not Working?

1. **Check Metro bundler logs** in the terminal for specific errors
2. **Check phone logs** using:
   ```bash
   npx react-native log-android  # Android
   npx react-native log-ios      # iOS
   ```
3. **Try a fresh build:**
   ```bash
   cd android && ./gradlew clean && cd ..
   npx expo run:android --clean
   ```

## Network Testing

Test if your phone can reach your computer:

1. Find your computer's IP (see step 3 above)
2. On your phone's browser, try: `http://YOUR_IP:8081`
3. You should see Metro bundler status page
4. If not, firewall/network is blocking the connection

