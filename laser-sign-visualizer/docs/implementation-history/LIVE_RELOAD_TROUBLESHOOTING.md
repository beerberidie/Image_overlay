# 🔧 **Live Reload Troubleshooting Guide**

## **🎯 Current Situation:**
- ✅ **Browser version**: Working at `http://192.168.88.96:5173`
- ✅ **Console logs**: Accessible via Chrome DevTools
- ✅ **isMobile error**: Fixed in code
- ⏳ **Mobile APK**: Building with live reload

---

## **🚀 Method 1: Capacitor Live Reload (In Progress)**

**Command Running:**
```powershell
npx cap run android --live-reload --host 192.168.88.96 --port 5173
```

**This Will:**
- Build app with live reload enabled
- Install on Samsung Galaxy S20+
- Connect to development server automatically
- Enable instant hot reload

**Expected Result:**
- App opens and connects to dev server
- Changes in code reload instantly on phone
- Console logs visible in Chrome DevTools

---

## **🔧 Method 2: Manual APK with Live Reload Config**

If Method 1 fails, use the manually built APK:

**APK Location:** `android/app/build/outputs/apk/debug/app-debug.apk`

**This APK includes:**
- ✅ Fixed `isMobile` undefined error
- ✅ Live reload configuration pointing to `192.168.88.96:5173`
- ✅ Network security config for development
- ✅ Cleartext traffic enabled

**Installation:**
1. Uninstall old version from phone
2. Install new APK
3. Open app → Should connect to dev server

---

## **🔍 Method 3: Verify Connection Issues**

### **Check Network Configuration:**
```powershell
# Verify dev server is accessible
curl http://192.168.88.96:5173

# Check if phone can reach computer
# On phone browser, go to: http://192.168.88.96:5173
```

### **Check Capacitor Config:**
```json
{
  "server": {
    "url": "http://192.168.88.96:5173",
    "cleartext": true
  }
}
```

### **Check Android Network Security:**
- File: `android/app/src/main/res/xml/network_security_config.xml`
- Allows cleartext traffic to development server

---

## **🛠️ Troubleshooting Steps**

### **If APK Still Shows Black Screen:**

1. **Check Console Logs:**
   - Chrome → `chrome://inspect`
   - Look for connection errors or JavaScript errors

2. **Verify Network Connection:**
   - Phone and computer on same WiFi
   - No firewall blocking port 5173
   - Dev server running and accessible

3. **Check App Permissions:**
   - Camera permission granted
   - Storage permission granted

4. **Force Refresh:**
   - Shake phone → "Reload" option
   - Or restart app completely

### **If Live Reload Not Working:**

1. **Check Dev Server:**
   ```powershell
   # Restart dev server if needed
   npm run dev
   ```

2. **Check Capacitor Config:**
   - Verify IP address matches your computer
   - Verify port 5173 is correct

3. **Rebuild with Live Reload:**
   ```powershell
   npx cap sync android
   npx cap run android --live-reload --host 192.168.88.96
   ```

---

## **🎯 Expected Behavior When Working:**

### **On Phone:**
- App opens and shows welcome screen (not black)
- "Start Camera" button visible and functional
- UI responds to touch interactions

### **In Chrome DevTools:**
- Console shows debug logs from phone
- No JavaScript errors
- Network tab shows connection to dev server

### **Live Reload:**
- Edit `src/App.jsx` → Save
- Phone automatically reloads (2-3 seconds)
- Changes visible immediately

---

## **📱 Testing the Fix:**

Once the app is working, test these features:

1. **Welcome Screen:**
   - Shows "Laser Sign Visualizer" title
   - "Start Camera" button visible

2. **Camera Permission:**
   - Tap "Start Camera"
   - Permission prompt appears
   - Grant permission

3. **Live Camera:**
   - Camera feed displays
   - AR overlay controls visible
   - Touch gestures work

4. **Live Reload:**
   - Make small change to App.jsx
   - Save file
   - Watch phone reload automatically

---

## **🚨 If All Methods Fail:**

### **Fallback: Production APK**
```powershell
# Remove live reload config
# Edit capacitor.config.json - remove server section
# Build production APK
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```

### **Debug with ADB:**
```powershell
# Check device connection
adb devices

# View app logs
adb logcat | findstr "Capacitor\|WebView\|Chromium"
```

---

## **✅ Success Indicators:**

- 📱 **App opens** without black screen
- 🔗 **Connects** to development server
- 📝 **Console logs** visible in Chrome DevTools
- ⚡ **Live reload** works when editing files
- 📷 **Camera** functions properly
- 🎯 **AR overlay** displays correctly

**The goal is to have both browser AND mobile versions working with live reload for efficient development!** 🚀
