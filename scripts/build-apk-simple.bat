@echo off
echo Building Laser Sign Visualizer APK...

echo Step 1: Building web assets...
call npm run build
if %errorlevel% neq 0 (
    echo Web build failed!
    pause
    exit /b 1
)

echo Step 2: Syncing with Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo Capacitor sync failed!
    pause
    exit /b 1
)

echo Step 3: Building APK...
cd android
call gradlew.bat assembleDebug --no-daemon
if %errorlevel% neq 0 (
    echo APK build failed!
    pause
    exit /b 1
)

echo.
echo ✅ APK built successfully!
echo 📱 Location: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Installation instructions:
echo 1. Connect Samsung S20+ via USB
echo 2. Enable USB Debugging
echo 3. Run: adb install app\build\outputs\apk\debug\app-debug.apk
echo.
pause
