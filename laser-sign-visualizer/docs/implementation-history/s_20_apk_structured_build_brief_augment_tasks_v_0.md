# S20 APK — Structured Build Brief & Augment Tasks

## 0) Project Snapshot
- **App Name:** <fill>
- **Primary Device:** Samsung S20 / Android 13+ (portrait‑first)
- **Core Use Case(s):** Overlay and export SVGs onto captured or imported images.

---

## 1) UX & Layout Rules (S20 Portrait‑First)
- Fix ghost UI: no hidden/stray elements under top nav or bottom buttons.
- Ensure all modals and export panels are fully scrollable on ~360×800dp viewport.
- Maintain proper safe areas above/below navigation bars.

---

## 2) Navigation Model
- **Global Nav:** Bottom bar (Home / Projects / Camera / Queue / Settings).
- **Secondary Nav:** Top tabs where applicable (e.g., Queue filters).
- **Back behavior:** Consistent across flows; add explicit back button in SVG select categories.

---

## 3) Screens & Key Flows
### 3.1 Dashboard
- Looks correct; remove ghost UI artifacts under nav bars.

### 3.2 Projects
- UI & spacing correct.
- Add **Delete Project** option (with confirmation).
- Project saving already works; leave unchanged.

### 3.3 Export Project
- All export types work except **PNG**.
- Fix: enable vertical scroll when content exceeds screen; adjust spacing so export buttons are visible and not cut off.

### 3.4 Settings
- Current Calibration and Project indicators unclear.
- Redesign Settings to include:
  - Import custom SVGs from storage (file picker).
  - Profile options (user metadata).
  - Storage location control.
  - Logs viewer (as already specified).
  - Calibration: either clarify its function or remove if redundant.

### 3.5 SVG Select / Categories
- Current issue: cramped view, can’t see contents.
- Fix:
  - Default: category panel thin.
  - On open: expand to thicker drawer.
  - On selecting a category: collapse/shorten so items are visible.
  - Provide **Back/Expand** button to return to enlarged view.
  - Optimize sizing/spacing for S20 portrait.

### 3.6 Camera / Gallery
- **Live Camera:** Functional but lags (frame-by-frame feel). Investigate and optimize preview rendering (use CameraX with surface provider).
- **Capture Button:** Currently non-functional; must trigger photo capture.
- **Capture Flow:** After capture, applying SVG works fine; keep unchanged.
- **Choose from Gallery / Mobile Gallery:**
  - Current bug: can select image but it fails to load (“cannot load image”), sometimes freezes app.
  - Fix: handle SAF (Scoped Storage) properly, decode images reliably, add error handling.

---

## 4) Data & Storage
- Already defined (Projects, Assets, Placements, Jobs).
- Add handling for user-imported SVGs via Settings.

---

## 5) Error Handling & Logging
- Ensure gallery load failures are logged (event with error details).
- Ensure capture button logs attempted use and success/failure.

---

## 6) AI (Augment) — Actionable Tasks
1. **Dashboard Fixes**: Remove ghost UI below nav bars.
2. **Projects**: Implement project delete (with confirm dialog).
3. **Export PNG Screen**: Add scroll; tighten spacing so action buttons are always visible.
4. **Settings Redesign**: Replace unclear Calibration/Project items with:
   - Custom SVG import
   - Profile info
   - Storage location control
   - Logs viewer (already spec’d)
5. **SVG Select UX**: Implement collapsible/expandable category panel with back/expand button.
6. **Camera**: Optimize live preview for smoothness (CameraX tuning).
7. **Capture Button**: Implement capture function → save to app storage.
8. **Gallery Import**: Fix SAF image loading; prevent freezes; robust error handling.

---

## 7) Acceptance Criteria
- Dashboard has no stray UI elements.
- Project section supports delete with confirmation.
- Export PNG screen scrolls correctly; no buttons hidden.
- Settings menu contains functional options (SVG import, storage, logs).
- SVG select panel usable and responsive; categories can expand/collapse.
- Camera preview smooth; capture button works; captured image flows into SVG overlay.
- Gallery import loads images without errors/freezes.

---

## 8) Backlog / Nice‑to‑Have
- Calibration feature (if meaningful) reintroduced with clear purpose.
- Performance profiling on live camera preview.
- Improved category navigation (search/filter SVGs).

---


---

# Update — 2025-09-19

## Notes captured
- **Startup/Dashboard**: Main dashboard looks perfect. Unexpected/"ghost" UI visible **under the top nav** and **above bottom buttons** on first launch.
- **Project Management**: Layout/spacing good. Request **Delete Project** option. Project saving works perfectly.
- **Export Project (PNG)**: PNG export view is too tall/over-spaced; cannot scroll; **export/exit buttons are hidden/obscured**. Needs scroll & layout fixes.
- **Settings**: “Calibration” unclear/inactive. "Project" indicator confusing. Request: define correct Settings for this app; include **Import Custom SVGs** from storage; populate with sensible test options.
- **SVG Select Panel**: Categories + contents are cramped; can’t see items. Want thinner category rail by default, expandable when opened; when a category is selected, **collapse/shorten** the category area so items are visible; add **Back/Expand** control.
- **Camera (Live)**: Preview lags like frame-by-frame; not smooth like native camera.
- **Capture Image Flow**: Works perfectly; **do not change**.
- **Choose from Gallery / Mobile Gallery**: Can pick an image but **fails to load** ("cannot load image"); sometimes app locks up.
- **Capture Button**: **Non-functional**; doesn’t trigger capture.

---

# MVP Implementation Blueprint — Actionable for Augment (2025-09-19)

> Build to S20 portrait-first constraints. All tasks atomic and idempotent. Link commits to section numbers.

## A) UI Integrity & Insets
1. **Remove Ghost UI** beneath top/bottom bars:
   - Enable edge-to-edge with WindowInsets and apply padding to root containers.
   - Ensure bottom nav is elevated above content; add `ViewCompat.setOnApplyWindowInsetsListener` to main container.
   - Verify no debug/diagnostic overlay is attached on launch; guard with build flag.
   - **Done when**: no stray UI visible under bars on cold/warm start across light/dark.

## B) Projects
2. **Add Delete Project**:
   - Long-press or overflow → Delete (confirm dialog: project title). Cascading delete of Assets, Placements, Jobs.
   - Implement Room `ON DELETE CASCADE` for FK relations.
   - **Done when**: project removed; related files in scoped storage deleted; undo not required (log event only).

## C) Export Project — PNG Screen
3. **Fix PNG export layout/scroll**:
   - Wrap content in `NestedScrollView`; convert bottom action area to **sticky bottom bar** (inset-aware) with Export/Cancel.
   - Reduce vertical spacing; make preview container `maxHeight = 0.6 * screenHeight`.
   - Ensure Back navigates without losing state; confirm all controls reachable at 360×800dp.
   - **Done when**: user can always reach action buttons and scroll the content; no clipping.

## D) Settings Rebuild (for Testing & Real Use)
4. **Define Settings sections**:
   - **General**: Units (mm/cm), Default export format (PNG/JPG), Export resolution (px / long-edge), Gesture sensitivity (drag/zoom), Theme.
   - **Projects**: Active project display (read-only), Default project location (scoped), Backup/Restore config (.json import/export).
   - **Assets**: **Import Custom SVGs** (SAF file picker, MIME `image/svg+xml`), Manage SVG cache (clear).
   - **Camera**: Preferred resolution, enable 60fps if supported, low-latency capture toggle.
   - **Calibration**: Wizard to map real-world scale:
     - Option A: Enter **distance to subject (m)** + desired **target size (mm)** to compute pixel/mm scale.
     - Option B: Photograph a **known-size marker**; input size; compute scale.
     - Store per-project calibration profile.
   - **Diagnostics**: **Logs viewer** (search, copy/share), permissions checker, reset cache.
   - **Done when**: Settings loads instantly (<300ms), each item functional or stubbed with clear status labels.

## E) SVG Select Panel — Adaptive UX
5. **Category Rail & Content Drawer**:
   - Default **thin rail** (min 72dp). Tap a category → expand to **200–240dp drawer**, showing subcategories.
   - Selecting a subcategory **collapses drawer height** to reveal item grid; add **Back/Expand** button to re-open.
   - Persist last selected category; ensure grid shows 2–3 columns depending on width.
   - **Done when**: Items visibly browseable without overlap; no clipped text/icons; back/expand works.

## F) Camera Pipeline
6. **Smooth Live Preview**:
   - Use **CameraX** `Preview` + `ImageCapture` only (no Analyzer while previewing).
   - Target 30–60fps where supported; set `setTargetRotation` each resume; use SurfaceProvider with `setImplementationMode(PERFORMANCE)`.
   - Profile on S20; ensure GC churn < 2/sec; disable unnecessary bitmap allocations.
   - **Done when**: preview latency subjectively matches stock camera panning; dropped frames minimal.

7. **Capture Button Wiring**:
   - Implement `ImageCapture.takePicture()` with executor callback; save to app-scoped file; emit to Overlay flow.
   - Debounce button; show capture flash & progress; handle failures gracefully.
   - **Done when**: tap reliably saves and opens image in SVG overlay.

8. **Gallery Import Fix (Android 13+)**:
   - Request `READ_MEDIA_IMAGES`; for SAF URIs call `takePersistableUriPermission`.
   - Load via `ContentResolver.openInputStream`; downsample large images using `BitmapFactory.Options.inSampleSize`.
   - Copy to app cache and resolve EXIF orientation; handle HEIC/large JPEGs; add error toasts/logs.
   - **Done when**: both **Choose from Gallery** and **Mobile Gallery** successfully load typical photos without freezes.

## G) Logging & Errors
9. **Interaction Log**:
   - Log `{ts, action, screen, result, details, projectId}` for: open app, open screen, capture, gallery import (uri), export PNG/JPG, delete project, settings changes.
   - Log rotated to 5MB; share from Settings.
   - **Done when**: copy/share txt exports and includes latest 500 events.

## H) QA & Acceptance
10. **Device QA (S20 portrait)**:
   - Verify no clipped UI on all screens; keyboard avoidance ok.
   - PNG export actions always reachable; SVG select panel behaves per spec.
   - Live camera smooth; capture works; gallery imports work.
   - **Regression**: capture/overlay flow unchanged where already good.

---

## Implementation Notes (Code-Level Hints)
- **Insets**: `WindowCompat.setDecorFitsSystemWindows(window, false)` + `ViewCompat.setOnApplyWindowInsetsListener(root) { ... }`.
- **Room**: `@ForeignKey(onDelete = CASCADE)` for Asset/Placement linking to Project.
- **CameraX**: prefer `QUALITY_1080P` or device-supported; set `CAPTURE_MODE_MINIMIZE_LATENCY`.
- **Bitmap decode**: First pass bounds → compute sample size for 1080–1440px long-edge target.
- **SVG**: AndroidSVG/Skia; render to Canvas at export time for PNG.

---

## Test Cases (Must Pass)
- T01: Cold start: no ghost UI; bars clean.
- T02: Delete Project removes associated assets/placements; UI updates without crash.
- T03: PNG export: scroll works; sticky action bar visible; export succeeds.
- T04: Settings: import SVG via SAF; change units & export resolution; calibration wizard saves profile.
- T05: SVG select: open → expand drawer → select category → items visible → back to expand.
- T06: Camera: preview smooth; capture saves & opens overlay.
- T07: Gallery import handles 12MP photo; no freeze; orientation correct.
- T08: Logs: shows last 500 events; share to text works.

