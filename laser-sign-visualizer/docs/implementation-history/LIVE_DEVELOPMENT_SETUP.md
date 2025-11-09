# 🚀 **Live Development Setup - Samsung Galaxy S20+**

## **📱 Step 1: Enable USB Debugging (Complete This First)**

### **Enable Developer Options:**
1. **Settings** → **About phone** → **Software information**
2. **Tap "Build number" 7 times** (you'll see "Developer mode enabled")
3. **Go back** → **Settings** → **Developer options** (now visible)

### **Enable USB Debugging:**
1. In **Developer options**, enable:
   - ✅ **USB debugging**
   - ✅ **Stay awake** (keeps screen on while charging)
   - ✅ **Install via USB** (if available)
2. **Connect USB cable** → Select **"File Transfer (MTP)"** mode
3. **Allow USB debugging** when popup appears → Check "Always allow"

---

## **🔧 Step 2: Install Development APK**

First, we need to install a development version that can connect to your computer:

```powershell
# Build and install development APK
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug --no-daemon
```

**Install the APK** from: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## **🌐 Step 3: Start Live Development Server**

### **Terminal 1 - Start Vite Development Server:**
```powershell
# In laser-sign-visualizer directory
npm run dev
```

**Expected Output:**
```
Local:   http://localhost:5173/
Network: http://192.168.1.11:5173/
```

### **Terminal 2 - Run Live Reload on Device:**
```powershell
# In laser-sign-visualizer directory
npx cap run android --livereload --external
```

**This will:**
- Build the app with live reload enabled
- Install it on your connected phone
- Connect the app to your development server
- Enable hot reload for instant updates

---

## **🔍 Step 4: Access Debug Console**

### **Method 1: Chrome DevTools (Recommended)**
1. **Open Chrome** on your computer
2. **Navigate to**: `chrome://inspect`
3. **Find your device** in the "Remote Target" section
4. **Click "Inspect"** next to your app
5. **Console tab** shows all `console.log()` output and errors

### **Method 2: Capacitor Live Reload Console**
- The terminal running `npx cap run android --livereload` shows basic logs
- Look for error messages and reload notifications

---

## **⚡ Step 5: Live Development Workflow**

### **Make Changes:**
1. **Edit** `src/App.jsx` or any React file
2. **Save** the file
3. **Watch** your phone automatically reload (2-3 seconds)
4. **Check console** in Chrome DevTools for any errors

### **Debug Black Screen Issue:**
1. **Open Chrome DevTools** (`chrome://inspect`)
2. **Check Console** for error messages
3. **Look for** our debug logs:
   - `"App component rendering..."`
   - `"SignSizerApp component rendering..."`
   - `"ARCameraBackground rendering with:"`
   - `"All hooks initialized successfully"`

### **Quick Test Changes:**
```javascript
// Add this to App.jsx to test live reload
console.log('Live reload test:', new Date().toLocaleTimeString());
```

---

## **🛠️ Troubleshooting Live Reload**

### **If Phone Shows "Could not connect to server":**
1. **Check WiFi**: Phone and computer on same network
2. **Check Firewall**: Windows Firewall might block port 5173
3. **Try different IP**: Use `192.168.88.96` instead of `192.168.1.11`

### **If Chrome DevTools Shows No Device:**
1. **Reconnect USB cable**
2. **Revoke USB debugging authorizations** in Developer options
3. **Re-enable USB debugging** and accept authorization again

### **If Changes Don't Reload:**
1. **Check terminal** for Vite server errors
2. **Restart development server**: Ctrl+C → `npm run dev`
3. **Force refresh**: Shake phone → "Reload" or restart app

---

## **🎯 Quick Commands Reference**

### **Start Development Session:**
```powershell
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run on device with live reload
npx cap run android --livereload --external
```

### **Debug Console Access:**
1. **Chrome** → `chrome://inspect`
2. **Find device** → **Click "Inspect"**
3. **Console tab** → See all logs and errors

### **Make Quick Changes:**
1. **Edit** React files
2. **Save** → Auto-reload on phone
3. **Check console** for errors
4. **Iterate rapidly** without APK rebuilds

---

## **🔍 Debug the Black Screen Issue**

With live reload setup, you can now:

1. **See console logs immediately** in Chrome DevTools
2. **Add debug statements** and see them instantly
3. **Test fixes rapidly** without 2-minute build cycles
4. **Isolate the problem** by commenting out components

### **Next Steps:**
1. **Complete the setup above**
2. **Open Chrome DevTools** to see console output
3. **Report what logs appear** when the app loads
4. **We can then make targeted fixes** with instant testing

**This setup will dramatically speed up debugging and fixing the black screen issue!** 🚀
