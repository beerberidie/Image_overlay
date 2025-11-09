# 📱 Laser Sign Visualizer

A mobile application for visualizing laser-cut signs on walls using camera overlay and AR technology. Built with Capacitor for Android deployment.

## ✨ Features

- **📷 Camera Overlay** - Real-time camera feed with image overlay
- **🖼️ Image Upload** - Upload custom sign designs
- **🎨 Image Manipulation** - Resize, rotate, and position signs
- **📐 AR Visualization** - See how signs look on walls before installation
- **💾 Save & Share** - Save visualizations and share with clients
- **📱 Mobile-First** - Optimized for Android devices
- **🎯 Touch Controls** - Intuitive pinch, zoom, and drag gestures

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Build Tool:** Vite
- **Mobile Framework:** Capacitor
- **Styling:** Tailwind CSS
- **Platform:** Android (APK)

## 📋 Prerequisites

- Node.js 16+ and npm
- Android Studio (for APK builds)
- Java JDK 11+
- Android SDK

## 🚀 Quick Start

### Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Image_overlay/laser-sign-visualizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

### Live Development on Device

1. **Start live development server**
   ```bash
   npm run dev:live
   # or
   ./start-live-dev.ps1
   ```

2. **Sync with Capacitor**
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio**
   ```bash
   npx cap open android
   ```

4. **Run on device** - Click "Run" in Android Studio

## 📦 Building APK

### Simple Build

```bash
# Windows
./build-apk-simple.bat

# PowerShell
./build-apk.ps1
```

### Manual Build

1. **Build web assets**
   ```bash
   npm run build
   ```

2. **Sync with Capacitor**
   ```bash
   npx cap sync android
   ```

3. **Open Android Studio**
   ```bash
   npx cap open android
   ```

4. **Build APK**
   - In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
   - APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## 📱 Deployment

### Install on Android Device

1. **Enable Developer Options** on your Android device
2. **Enable USB Debugging**
3. **Connect device via USB**
4. **Install APK**
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Deploy to Google Play Store

1. **Build release APK**
   - In Android Studio: Build → Generate Signed Bundle / APK
   - Follow the signing wizard

2. **Upload to Google Play Console**
   - Create app listing
   - Upload APK/AAB
   - Complete store listing
   - Submit for review

## 🎮 Usage

1. **Launch the app** on your Android device
2. **Grant camera permissions** when prompted
3. **Upload a sign image** using the upload button
4. **Position the sign** on the camera view using touch gestures:
   - **Drag** - Move the sign
   - **Pinch** - Resize the sign
   - **Rotate** - Two-finger rotation
5. **Save or share** the visualization

## 🏗️ Project Structure

```
laser-sign-visualizer/
├── src/                    # Source code
│   ├── main.js             # Main application logic
│   ├── style.css           # Styles
│   └── ...
├── public/                 # Static assets
├── android/                # Capacitor Android project
├── tests/                  # Test files
├── dist/                   # Build output (gitignored)
├── docs/                   # Documentation
│   └── implementation-history/  # Development history
├── scripts/                # Build scripts
├── index.html              # Entry point
├── package.json            # Dependencies
├── capacitor.config.json   # Capacitor configuration
├── vite.config.js          # Vite configuration
└── tailwind.config.js      # Tailwind configuration
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🔧 Configuration

### Capacitor Configuration

Edit `capacitor.config.json`:

```json
{
  "appId": "com.lasersign.visualizer",
  "appName": "Laser Sign Visualizer",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

### Vite Configuration

Edit `vite.config.js` for build settings.

### Tailwind Configuration

Edit `tailwind.config.js` for styling customization.

## 📝 Development Notes

- **Camera Permissions** - Required for camera overlay functionality
- **Storage Permissions** - Required for saving images
- **Network Permissions** - Required for live development
- **Performance** - Optimized for Samsung S20 and similar devices
- **Orientation** - Supports portrait and landscape modes

## 🐛 Troubleshooting

### Black Screen on Device

- Check camera permissions
- Verify Capacitor sync: `npx cap sync android`
- Check Android logs: `adb logcat`

### Connection Timeout (Live Dev)

- Ensure device and computer are on same network
- Check firewall settings
- Use IP address instead of localhost

### Build Errors

- Clean build: `cd android && ./gradlew clean`
- Invalidate caches in Android Studio
- Update Android SDK and build tools

## 📚 Documentation

For detailed implementation history and development notes, see:
- [Implementation History](laser-sign-visualizer/docs/implementation-history/)
- [Deployment Guide](laser-sign-visualizer/docs/implementation-history/DEPLOYMENT_GUIDE_SAMSUNG_S20.md)
- [Live Development Setup](laser-sign-visualizer/docs/implementation-history/LIVE_DEVELOPMENT_SETUP.md)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Capacitor](https://capacitorjs.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Bundled with [Vite](https://vitejs.dev/)

---

**Made with ❤️ for laser cutting businesses**

