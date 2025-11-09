
# Laser Sign Visualizer — **MVP & APK Blueprint**

A lean, **on‑site** photo overlay tool to preview laser‑cut sign numbers at **true scale** on walls/fascia. Built to run as an **Android APK** (Samsung S20+) using **React + Capacitor**. The default UX is **Simple Mode**: Take/Pick photo → Calibrate → Add SVG → Set height (mm) → Drag/Rotate → **Export to Gallery**. Advanced tools are hidden under **More Options**.

---

## ✅ MVP Features (v1)

- **Simple Mode (default)**: one sign layer, big buttons, zero clutter.
- **Capture or pick site photo** (Capacitor Camera / `<input type="file">`).
- **Millimetre calibration**: tap two points on the photo and enter the known distance (mm).
- **Add SVG** of your number/wordmark; set **target height (mm)**.
- Drag, rotate, adjust opacity; **Export to Gallery** (`Pictures/LaserSign/…`).
- **More Options** (collapsible): multi-layer, lock layers, manual scale, project **Save/Load**, live camera overlay.

> Not AR. This is a **reliable photo overlay** MVP for speed offline. ARCore/WebXR can be added later.

---

## 🧭 Workflow (on site)

1. **Take Photo** (or **Pick Photo** from Gallery).  
2. **Calibrate**: tap two points you can measure (e.g., brick seams, tape ends) → enter **mm**.  
3. **Add SVG** (your number).  
4. Set **Height (mm)** (or use quick presets).  
5. **Drag/Rotate** into place → **Export to Gallery** and show the client.

**Tip:** add a reference object in-frame (tape, A4 sheet = 210×297 mm) to speed up calibration.

---

## 🧰 Tech Stack

- **UI**: React (Vite), optional Tailwind CSS for styling (used in this MVP).
- **Native shell**: Capacitor (Android).
- **Plugins**: `@capacitor/camera`, `@capacitor/filesystem`.
- **Target**: Android 10+ (Samsung S20+), offline‑friendly.

---

## 📁 Suggested Repo Structure

```
laser-sign-visualizer/
├─ android/                    # Capacitor Android project (auto-generated)
├─ public/
├─ src/
│  ├─ App.jsx                  # <-- FULL MVP UI (below)
│  ├─ main.jsx
│  └─ index.css                # Tailwind entry (optional)
├─ index.html
├─ package.json
├─ tailwind.config.js          # (optional)
├─ postcss.config.js           # (optional)
└─ vite.config.js
```

---

## 🚀 Setup, Build, and Install (Step‑by‑Step)

### 1) Create the project
```bash
npm create vite@latest laser-sign-visualizer -- --template react
cd laser-sign-visualizer
npm i
```

> **Tailwind (optional, for this UI)**  
```bash
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
`tailwind.config.js`
```js
export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```
`src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 2) Add Capacitor & plugins
```bash
npm i @capacitor/core @capacitor/cli
npx cap init "Laser Sign Visualizer" "com.yourname.lasersigns" --web-dir=dist

npm i @capacitor/android
npm i @capacitor/filesystem @capacitor/camera
```

### 3) Vite config (defaults work)
`vite.config.js`
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
```

### 4) Drop in the **FULL MVP** code
Replace `src/App.jsx` with the code in the **“Full App.jsx”** section below.  
Ensure `src/main.jsx` imports it and `src/index.css` exists (if using Tailwind).

`src/main.jsx`
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

### 5) Android platform & permissions
```bash
npx cap add android
```

`android/app/src/main/AndroidManifest.xml` — ensure:
```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<!-- For older Androids: -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28"/>
```

### 6) Build & sync
```bash
npm run build
npx cap copy
npx cap open android
```

### 7) Install on device (Samsung S20+)
- In **Android Studio** → click **Run** (USB debugging on), or  
- Build → Build Bundle(s)/APK(s) → **Build APK(s)** and sideload.

On first run, grant **Camera** and **Photos/Media** permissions.

---

## 🧪 Usage Notes & Calibration Tips

- Calibration is **photo-specific**. Do it once per photo.
- Use long baselines for better accuracy (e.g., multiple bricks / full tape length).
- Set target **Height (mm)** to your intended installed size (e.g., 400 mm).
- For composite words/addresses, open **More Options** and add multiple SVG layers.

---

## 🧩 SVG Prep Guidelines

- Use **pure SVG** (no external fonts). Convert text to paths in your design tool.
- Clean up extra padding; keep viewBox tight to the glyphs for easier placement.
- If numbers are intended at specific heights (e.g., 200/300/400 mm), name files accordingly.

---

## 🛠 Troubleshooting

- **Camera preview black**: Ensure Android permissions granted. Reopen app.
- **Photo rotation odd**: Capture from within the app if possible (EXIF orientation quirks).
- **Export not in Gallery**: File saved to `Pictures/LaserSign`. Open “Albums” → Pictures (or Files app).  
- **Calibration feels off**: Re‑do with a longer baseline (1m+). Check the mm value.

---

## ➕ Roadmap (optional next)

- Snap toggle (0/15/30°), custom height presets (120/240/480 mm).
- Project bundles (zip: photo + layers + JSON state).
- WebXR/ARCore edition with hit‑test and real‑world placement.

---

## 📜 Full `App.jsx` (MVP)

```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Laser Sign Visualizer — APK‑ready MVP (Simple by default + “More Options”)
 *
 * Default = SIMPLE:
 *  - Big buttons: Take Photo / Pick Photo / Add SVG
 *  - One sign layer, height‑mm, rotate, drag, export
 *  - Calibration (2 taps + mm)
 *
 * “MORE OPTIONS” (collapsible):
 *  - When opened, enables multi‑layer workflow, save/load, camera overlay
 *  - When closed, returns to single‑layer simple mode
 *
 * Stack: React + (optional) Tailwind + Capacitor Camera/Filesystem.
 */

import { Filesystem, Directory } from "@capacitor/filesystem";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export default function App() {
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <Header />
      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <SignSizerApp />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 p-3">
        <div className="size-8 rounded-xl bg-neutral-800/80 grid place-items-center"><span className="text-sm">Σ</span></div>
        <h1 className="text-lg font-semibold tracking-tight">Laser Sign Visualizer</h1>
        <div className="ml-auto text-xs text-neutral-400">Simple • mm‑accurate • APK‑ready</div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-900/70 text-neutral-400">
      <div className="mx-auto max-w-6xl p-4 text-xs md:text-[13px]">
        Tip: In Simple mode, you have a single sign layer. Open <em>More Options</em> for multi‑layer and project tools.
      </div>
    </footer>
  );
}

// Types
/** @typedef {{x:number,y:number}} Point */
/** @typedef {{id:string,name:string,svgText:string,url:string,x:number,y:number,rot:number,heightMM:number,scale:number,opacity:number,lock:boolean}} Layer */

function SignSizerApp() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);

  // Mode: simple by default. When More Options is open → advanced (false)
  const [simpleMode, setSimpleMode] = useState(true);

  // Background
  const [bgImage, setBgImage] = useState(null);
  const [bgImageFit, setBgImageFit] = useState({ w: 0, h: 0, x: 0, y: 0 });
  const [useCamera, setUseCamera] = useState(false);
  const [stream, setStream] = useState(null);

  // Calibration
  const [calibPoints, setCalibPoints] = useState([]);
  const [calibDistanceMM, setCalibDistanceMM] = useState("");
  const [pxPerMM, setPxPerMM] = useState(null);

  // Layers
  const [layers, setLayers] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Project
  const [projectName, setProjectName] = useState("Untitled Site");

  const activeLayer = useMemo(() => layers.find(l => l.id === activeId) || null, [layers, activeId]);

  // Camera
  useEffect(() => {
    (async () => {
      if (useCamera) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          setStream(s); if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
        } catch (e) { console.error("Camera error", e); setUseCamera(false); }
      } else { if (stream) stream.getTracks().forEach(t => t.stop()); setStream(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCamera]);

  // Calibration compute
  const calibPX = calibPoints.length === 2 ? Math.hypot(calibPoints[0].x - calibPoints[1].x, calibPoints[0].y - calibPoints[1].y) : null;
  useEffect(() => { if (calibPX && calibDistanceMM && calibDistanceMM > 0) setPxPerMM(calibPX / Number(calibDistanceMM)); }, [calibPX, calibDistanceMM]);

  // Fit background
  const fitBG = () => {
    if (!bgImage || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const scale = Math.max(rect.width / bgImage.width, rect.height / bgImage.height);
    const w = bgImage.width * scale, h = bgImage.height * scale; const x = (rect.width - w) / 2, y = (rect.height - h) / 2;
    setBgImageFit({ w, h, x, y });
  };
  useEffect(() => { const el = stageRef.current; if (!el) return; const obs = new ResizeObserver(() => fitBG()); obs.observe(el); return () => obs.disconnect(); }, [bgImage]);

  // Stage click for calibration
  const stageClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let pts = [...calibPoints, { x, y }]; if (pts.length > 2) pts = pts.slice(-2); setCalibPoints(pts);
  };

  // Photo pick/capture
  const onPickPhoto = (file) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { setBgImage(img); URL.revokeObjectURL(url); fitBG(); setCalibPoints([]); setPxPerMM(null); };
    img.src = url;
  };
  const capturePhoto = async () => {
    try { const res = await Camera.getPhoto({ resultType: CameraResultType.Uri, source: CameraSource.Camera, quality: 90 });
      const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { setBgImage(img); fitBG(); setCalibPoints([]); setPxPerMM(null); };
      img.src = res.webPath || res.path || ""; } catch {}
  };

  // Add SVG (simple: single layer; advanced: multiple)
  const onPickSVG = (file) => {
    const reader = new FileReader(); reader.onload = () => {
      const text = String(reader.result); const blob = new Blob([text], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob);
      const base = { id: Math.random().toString(36).slice(2), name: file.name.replace(/\\.svg$/i, ""), svgText: text, url, x: 200, y: 200, rot: 0, heightMM: 200, scale: 1, opacity: 1, lock: false };
      if (simpleMode) { setLayers([base]); setActiveId(base.id); } else { setLayers(ls => [...ls, base]); setActiveId(base.id); }
    }; reader.readAsText(file);
  };

  // Layer sizing
  const layerSizePX = (l) => { const hpx = (pxPerMM ? pxPerMM : 1) * l.heightMM * l.scale; const wpx = hpx; return { wpx, hpx }; };

  // Drag/Rotate/Resize (mouse‑based for MVP)
  const [dragging, setDragging] = useState(null);
  const [rotating, setRotating] = useState(null);
  const [resizing, setResizing] = useState(null);

  const beginDrag = (id, e) => { const l = layers.find(x => x.id === id)!; if (l.lock) return; e.stopPropagation(); const rect = stageRef.current.getBoundingClientRect(); setDragging({ id, dx: e.clientX - rect.left - l.x, dy: e.clientY - rect.top - l.y }); };
  const onDrag = (e) => { if (!dragging) return; const rect = stageRef.current.getBoundingClientRect(); setLayers(ls => ls.map(l => l.id === dragging.id ? { ...l, x: e.clientX - rect.left - dragging.dx, y: e.clientY - rect.top - dragging.dy } : l)); };
  const endDrag = () => setDragging(null);

  const startRotate = (id, e) => { const l = layers.find(x => x.id === id)!; if (l.lock) return; e.stopPropagation(); setRotating({ id }); };
  const doRotate = (e) => { if (!rotating || !stageRef.current) return; const l = layers.find(x => x.id === rotating.id)!; const rect = stageRef.current.getBoundingClientRect(); const { wpx, hpx } = layerSizePX(l); const cx = l.x + wpx / 2, cy = l.y + hpx / 2; const x = e.clientX - rect.left, y = e.clientY - rect.top; const ang = Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90; setLayers(ls => ls.map(x => x.id === l.id ? { ...x, rot: ang } : x)); };
  const endRotate = () => setRotating(null);

  const startResize = (id, e) => { const l = layers.find(x => x.id === id)!; if (l.lock) return; e.stopPropagation(); const { wpx, hpx } = layerSizePX(l); const base = Math.hypot(wpx / 2, hpx / 2); setResizing({ id, base }); };
  const doResize = (e) => { if (!resizing || !stageRef.current) return; const l = layers.find(x => x.id === resizing.id)!; const rect = stageRef.current.getBoundingClientRect(); const { wpx, hpx } = layerSizePX(l); const cx = l.x + wpx / 2, cy = l.y + hpx / 2; const x = e.clientX - rect.left, y = e.clientY - rect.top; const dist = Math.hypot(x - cx, y - cy); const factor = Math.max(0.05, dist / resizing.base); setLayers(ls => ls.map(x => x.id === l.id ? { ...x, scale: factor } : x)); };
  const endResize = () => setResizing(null);

  const onWheel = (e) => { if (!activeId) return; setLayers(ls => ls.map(l => l.id === activeId ? { ...l, scale: Math.max(0.05, l.scale * (e.deltaY > 0 ? 0.95 : 1.05)) } : l)); };

  // Export → Gallery
  const exportPNG = async () => {
    if (!canvasRef.current || !stageRef.current) return; const canvas = canvasRef.current; const ctx = canvas.getContext("2d"); const rect = stageRef.current.getBoundingClientRect(); canvas.width = Math.round(rect.width); canvas.height = Math.round(rect.height);
    if (useCamera && videoRef.current) ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); else if (bgImage) ctx.drawImage(bgImage, bgImageFit.x, bgImageFit.y, bgImageFit.w, bgImageFit.h); else { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    for (const l of layers) { const img = await loadImageFromURL(l.url); const { hpx } = layerSizePX(l); const wEst = hpx; ctx.save(); const cx = l.x + wEst / 2, cy = l.y + hpx / 2; ctx.translate(cx, cy); ctx.rotate((l.rot * Math.PI) / 180); ctx.globalAlpha = l.opacity; ctx.drawImage(img, -wEst / 2, -hpx / 2, wEst, hpx); ctx.restore(); }
    const dataUrl = canvas.toDataURL("image/png");
    try { const base64 = dataUrl.split(",")[1]; const fileName = `SignViz_${new Date().toISOString().replace(/[:.]/g, "-")}.png`; await Filesystem.mkdir({ directory: Directory.Pictures, path: "LaserSign" }).catch(() => {}); await Filesystem.writeFile({ directory: Directory.Pictures, path: `LaserSign/${fileName}`, data: base64 }); alert(`Saved: Gallery/Pictures/LaserSign/${fileName}`); } catch (e) { const a = document.createElement("a"); a.download = "sign-mockup.png"; a.href = dataUrl; a.click(); }
  };

  // Save/Load (Advanced)
  const saveProject = () => { const payload = { projectName, calibPoints, calibDistanceMM, layers: layers.map(l => ({ ...l, url: undefined })) }; localStorage.setItem("signviz_project", JSON.stringify(payload)); alert("Project saved."); };
  const loadProject = () => { const raw = localStorage.getItem("signviz_project"); if (!raw) return alert("No saved project."); try { const p = JSON.parse(raw); setProjectName(p.projectName || "Untitled Site"); setCalibPoints(p.calibPoints || []); setCalibDistanceMM(p.calibDistanceMM || ""); const rebuilt = (p.layers || []).map((l) => { const blob = new Blob([l.svgText], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); return { ...l, url }; }); setLayers(rebuilt); setActiveId(rebuilt[0]?.id || null); } catch { alert("Load failed."); } };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px,1fr]" onWheel={onWheel}>
      {/* Controls */}
      <aside className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        {/* SIMPLE PANEL */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={capturePhoto} className="rounded-xl border border-neutral-600 bg-neutral-100/5 px-3 py-3 text-sm font-semibold">Take Photo</button>
            <label className="rounded-xl border border-neutral-700 px-3 py-3 text-center text-sm cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files && onPickPhoto(e.target.files[0])} />Pick Photo
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-400">Add SVG (your number)</span>
            <input type="file" accept="image/svg+xml" onChange={e => e.target.files && onPickSVG(e.target.files[0])} />
          </label>
          <div className="rounded-lg border border-neutral-800 p-2">
            <div className="text-xs text-neutral-400 mb-1">Calibration: tap 2 points on the photo, enter real distance (mm)</div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} placeholder="Distance (mm)" value={calibDistanceMM} onChange={e => setCalibDistanceMM(e.target.value ? Number(e.target.value) : "")} className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm"/>
              <div className="text-[11px] text-neutral-400">{pxPerMM ? `${pxPerMM.toFixed(2)} px/mm` : "uncalibrated"}</div>
              <button className="rounded-xl border border-neutral-700 px-2 py-1 text-xs" onClick={() => { setCalibPoints([]); setPxPerMM(null); }}>Reset</button>
            </div>
          </div>
          {activeLayer && (
            <div className="rounded-lg border border-neutral-800 p-2 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2">Height (mm)
                  <input type="number" className="w-full rounded border border-neutral-700 bg-neutral-900 p-1" value={activeLayer.heightMM} onChange={e => setLayers(ls => ls.map(x => x.id === activeLayer.id ? { ...x, heightMM: Number(e.target.value) } : x))} />
                </label>
                <div className="col-span-2 flex gap-1">
                  {[100,150,200,300,400,500].map(v => (
                    <button key={v} className="rounded border border-neutral-700 px-2 py-1" onClick={() => setLayers(ls => ls.map(x => x.id === activeLayer.id ? { ...x, heightMM: v } : x))}>{v}mm</button>
                  ))}
                </div>
                <label>Opacity
                  <input type="range" min={0.2} max={1} step={0.05} value={activeLayer.opacity} onChange={e => setLayers(ls => ls.map(x => x.id === activeLayer.id ? { ...x, opacity: Number(e.target.value) } : x))} />
                </label>
                <label>Rotation (°)
                  <input type="number" className="w-full rounded border border-neutral-700 bg-neutral-900 p-1" value={activeLayer.rot} onChange={e => setLayers(ls => ls.map(x => x.id === activeLayer.id ? { ...x, rot: Number(e.target.value) } : x))} />
                </label>
              </div>
            </div>
          )}
          <button onClick={exportPNG} className="w-full rounded-xl border border-emerald-500 bg-emerald-500/10 px-3 py-3 text-sm font-semibold">Export to Gallery</button>
        </div>

        {/* MORE OPTIONS (Advanced) */}
        <details className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/50 p-3" onToggle={(e) => setSimpleMode(!(e.currentTarget).open)}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-neutral-200">More Options</summary>
          <div className="mt-3 space-y-4 text-sm">
            <Section title="Project">
              <div className="flex gap-2">
                <input className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm" value={projectName} onChange={e => setProjectName(e.target.value)} />
                <button className="rounded-xl border border-neutral-600 bg-neutral-100/5 px-3 py-2 text-sm" onClick={saveProject}>Save</button>
                <button className="rounded-xl border border-neutral-700 px-3 py-2 text-sm" onClick={loadProject}>Load</button>
              </div>
            </Section>
            <Section title="Background (Advanced)">
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setUseCamera(v => !v)} className={`rounded-xl px-3 py-2 text-sm font-medium border ${useCamera ? "border-emerald-400 text-emerald-300" : "border-neutral-700 text-neutral-200"}`}>{useCamera ? "Disable Camera" : "Enable Camera"}</button>
                <button onClick={capturePhoto} className="rounded-xl border border-neutral-700 px-3 py-2 text-sm">Capture Photo</button>
              </div>
            </Section>
            <Section title="Layers (Multiple SVGs)">
              <div className="flex items-center gap-2">
                <label>
                  <span className="mb-1 block text-xs text-neutral-400">Add SVG</span>
                  <input type="file" accept="image/svg+xml" onChange={e => e.target.files && onPickSVG(e.target.files[0])} />
                </label>
              </div>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                {layers.map(l => (
                  <div key={l.id} className={`rounded-lg border p-2 ${activeId === l.id ? "border-emerald-500" : "border-neutral-700"}`}>
                    <div className="flex items-center gap-2">
                      <input className="flex-1 rounded bg-neutral-900 p-1 text-sm" value={l.name} onChange={e => setLayers(ls => ls.map(x => x.id === l.id ? { ...x, name: e.target.value } : x))} />
                      <button className="rounded border border-neutral-700 px-2 py-1 text-xs" onClick={() => setActiveId(l.id)}>Select</button>
                      <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={l.lock} onChange={e => setLayers(ls => ls.map(x => x.id === l.id ? { ...x, lock: e.target.checked } : x))}/>Lock</label>
                      <button className="rounded border border-neutral-700 px-2 py-1 text-xs" onClick={() => setLayers(ls => ls.filter(x => x.id !== l.id))}>Del</button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <label className="col-span-2">Height (mm)<input type="number" className="w-full rounded border border-neutral-700 bg-neutral-900 p-1" value={l.heightMM} onChange={e => setLayers(ls => ls.map(x => x.id === l.id ? { ...x, heightMM: Number(e.target.value) } : x))} /></label>
                      <label>Opacity<input type="range" min={0.2} max={1} step={0.05} value={l.opacity} onChange={e => setLayers(ls => ls.map(x => x.id === l.id ? { ...x, opacity: Number(e.target.value) } : x))} /></label>
                      <label>Rotation (°)<input type="number" className="w-full rounded border border-neutral-700 bg-neutral-900 p-1" value={l.rot} onChange={e => setLayers(ls => ls.map(x => x.id === l.id ? { ...x, rot: Number(e.target.value) } : x))} /></label>
                      <label className="col-span-2">Manual scale (×)<input type="range" min={0.05} max={5} step={0.01} value={l.scale} onChange={e => setLayers(ls => ls.map(x => x.id === l.id ? { ...x, scale: Number(e.target.value) } : x))} /></label>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </details>
      </aside>

      {/* Stage */}
      <section className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60">
        <div
          ref={stageRef}
          className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl"
          onMouseMove={e => { onDrag(e); doRotate(e); doResize(e); }}
          onMouseUp={() => { endDrag(); endRotate(); endResize(); }}
          onMouseLeave={() => { endDrag(); endRotate(); endResize(); }}
          onWheel={onWheel}
          onClick={stageClick}
        >
          {/* Background */}
          <div className="absolute inset-0 grid place-items-center bg-neutral-900">
            {useCamera ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            ) : bgImage ? (
              <img src={bgImage.src} alt="background" style={{ position: "absolute", left: bgImageFit.x, top: bgImageFit.y, width: bgImageFit.w, height: bgImageFit.h }} />
            ) : (
              <div className="text-neutral-500">Take or pick a photo, add your SVG, drag it into place.</div>
            )}
          </div>

          {/* Calibration overlay */}
          {calibPoints.length > 0 && (
            <svg className="pointer-events-none absolute inset-0">
              {calibPoints.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={6} fill="#f97316" stroke="#000" strokeWidth={2} />))}
              {calibPoints.length === 2 && (<line x1={calibPoints[0].x} y1={calibPoints[0].y} x2={calibPoints[1].x} y2={calibPoints[1].y} stroke="#f97316" strokeWidth={3} />)}
            </svg>
          )}

          {/* Layers */}
          {layers.map(l => {
            const { hpx } = layerSizePX(l); const wEst = hpx;
            return (
              <div key={l.id} className="group absolute select-none" style={{ left: l.x, top: l.y, width: wEst, height: hpx, transform: `rotate(${l.rot}deg)`, opacity: l.opacity }}>
                <div onMouseDown={(e) => beginDrag(l.id, e)} className={`absolute inset-0 ${l.lock ? "cursor-not-allowed" : "cursor-move"}`}> 
                  <img src={l.url} alt={l.name} className="h-full w-full object-contain" draggable={false} onClick={() => setActiveId(l.id)} />
                </div>
                {!l.lock && (<button onMouseDown={(e) => startRotate(l.id, e)} className="absolute -left-3 -top-3 size-6 cursor-crosshair rounded-full border border-neutral-700 bg-neutral-900/80 text-[10px]" title="Rotate">⟲</button>)}
                {!l.lock && (<button onMouseDown={(e) => startResize(l.id, e)} className="absolute -right-3 -bottom-3 size-6 cursor-nesw-resize rounded-full border border-neutral-700 bg-neutral-900/80 text-[10px]" title="Resize">⤢</button>)}
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/80 px-2 py-1 text-[11px] opacity-0 shadow-md ring-1 ring-neutral-700 transition-opacity group-hover:opacity-100">{pxPerMM ? `${l.heightMM} mm` : `${l.heightMM} mm (uncalibrated)`}</div>
              </div>
            );
          })}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </section>
    </div>
  );
}

function Header() {
  return null;
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
      <h2 className="mb-2 text-sm font-semibold text-neutral-200">{title}</h2>
      {children}
    </div>
  );
}

async function loadImageFromURL(url) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
}
```

> **Note:** If you aren’t using Tailwind, replace classNames with your own CSS, or include a minimal CSS file.

---

## 🔐 Signing (optional for distribution)

Use Android Studio → **Build > Generate Signed Bundle/APK** → APK → create keystore → sign and build. Share the resulting APK as needed.

---

## 📄 License

MIT (or your preference).

