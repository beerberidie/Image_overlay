#!/usr/bin/env pwsh

# Laser Sign Visualizer APK Build Script
# This script builds both debug and release APK files

Write-Host "🔧 Building Laser Sign Visualizer APK..." -ForegroundColor Green

# Step 1: Build the web assets
Write-Host "📦 Building web assets..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Web build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Sync with Capacitor
Write-Host "🔄 Syncing with Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Capacitor sync failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Clean any existing builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "android\app\build") {
    Remove-Item -Recurse -Force "android\app\build"
}

# Step 4: Build debug APK
Write-Host "🔨 Building debug APK..." -ForegroundColor Yellow
Set-Location android
try {
    .\gradlew clean assembleDebug --no-daemon --stacktrace
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Debug APK built successfully!" -ForegroundColor Green
        $debugApk = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $debugApk) {
            Write-Host "📱 Debug APK location: android\$debugApk" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Debug APK build failed!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error building debug APK: $_" -ForegroundColor Red
}

# Step 5: Build release APK (unsigned)
Write-Host "🔨 Building release APK..." -ForegroundColor Yellow
try {
    .\gradlew assembleRelease --no-daemon --stacktrace
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Release APK built successfully!" -ForegroundColor Green
        $releaseApk = "app\build\outputs\apk\release\app-release-unsigned.apk"
        if (Test-Path $releaseApk) {
            Write-Host "📱 Release APK location: android\$releaseApk" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Release APK build failed!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error building release APK: $_" -ForegroundColor Red
}

Set-Location ..

Write-Host "🎉 APK build process completed!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Connect your Samsung S20+ via USB" -ForegroundColor White
Write-Host "  2. Enable USB Debugging in Developer Options" -ForegroundColor White
Write-Host "  3. Install using: adb install android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
Write-Host "  4. Or copy the APK file to your device and install manually" -ForegroundColor White
