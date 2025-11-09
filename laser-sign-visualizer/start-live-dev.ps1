# Live Development Setup Script for Samsung Galaxy S20+
# Run this script to start live development with hot reload

Write-Host "🚀 Starting Live Development Setup for Samsung Galaxy S20+" -ForegroundColor Green
Write-Host ""

# Check if device is connected
Write-Host "📱 Checking for connected Android devices..." -ForegroundColor Yellow
$devices = adb devices
if ($devices -match "device$") {
    Write-Host "✅ Android device detected!" -ForegroundColor Green
} else {
    Write-Host "❌ No Android device found. Please:" -ForegroundColor Red
    Write-Host "   1. Connect your Samsung Galaxy S20+ via USB" -ForegroundColor Red
    Write-Host "   2. Enable USB Debugging in Developer Options" -ForegroundColor Red
    Write-Host "   3. Accept USB debugging authorization on your phone" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Configuration:" -ForegroundColor Cyan
Write-Host "   • Development Server: http://192.168.1.11:5173" -ForegroundColor White
Write-Host "   • Live Reload: Enabled" -ForegroundColor White
Write-Host "   • Debug Console: chrome://inspect" -ForegroundColor White

Write-Host ""
Write-Host "🌐 Starting development server..." -ForegroundColor Yellow

# Start the development process
Write-Host "Starting Vite dev server in background..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev" -WindowStyle Normal

# Wait a moment for server to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "📱 Building and deploying to device with live reload..." -ForegroundColor Yellow
npx cap run android --livereload --external

Write-Host ""
Write-Host "🎉 Live development setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Open Chrome and go to: chrome://inspect" -ForegroundColor White
Write-Host "   2. Find your device and click 'Inspect'" -ForegroundColor White
Write-Host "   3. Check the Console tab for debug logs" -ForegroundColor White
Write-Host "   4. Make changes to src/App.jsx and watch them reload instantly!" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Debug the black screen by checking console logs in Chrome DevTools" -ForegroundColor Yellow
