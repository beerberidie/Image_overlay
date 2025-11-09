import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * Laser Sign Visualizer — Full-Screen AR Overlay Application
 *
 * Transformed from desktop MVP to immersive AR overlay with:
 *  - Full-screen camera background
 *  - Transparent navigation bar with branding
 *  - Three-button bottom control system
 *  - Real-time SVG overlay manipulation
 *  - Distance-based accurate scaling
 *
 * Architecture: React + Tailwind + Capacitor Camera/Filesystem
 * Layout: Full-screen AR overlay with preserved touch gesture system
 */

import { Filesystem, Directory } from "@capacitor/filesystem";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

// ============================================================================
// CUSTOM HOOKS - Extracted reusable logic for clean separation of concerns
// ============================================================================

/**
 * Enhanced touch gestures hook with advanced multi-touch and real-time feedback
 * Professional-grade gesture recognition and visual feedback systems
 */
function useTouchGestures(layers, setLayers, activeId, stageRef) {
  const [dragging, setDragging] = useState(null);
  const [rotating, setRotating] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [touchState, setTouchState] = useState({
    touches: [],
    initialDistance: null,
    initialScale: 1,
    initialRotation: 0,
    isGesturing: false,
    gestureType: null, // 'drag', 'pinch', 'rotate', 'multi'
    gestureStartTime: null,
    lastGestureUpdate: null
  });

  // Advanced gesture state
  const [gestureHistory, setGestureHistory] = useState([]);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [precisionMode, setPrecisionMode] = useState(false);
  const [gestureVelocity, setGestureVelocity] = useState({ x: 0, y: 0 });

  // Grid and snap settings
  const gridSize = 10; // pixels
  const snapThreshold = 15; // pixels

  // Enhanced touch gesture helper functions
  const calculateDistance = useCallback((touch1, touch2) => {
    return Math.hypot(
      touch1.clientX - touch2.clientX,
      touch1.clientY - touch2.clientY
    );
  }, []);

  const calculateRotation = useCallback((touch1, touch2) => {
    return Math.atan2(
      touch2.clientY - touch1.clientY,
      touch2.clientX - touch1.clientX
    ) * 180 / Math.PI;
  }, []);

  const calculateCenter = useCallback((touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }, []);

  const getEventCoords = useCallback((e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }, []);

  // Snap to grid function
  const snapToGridCoords = useCallback((x, y) => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  }, [snapToGrid, gridSize]);

  // PERFORMANCE OPTIMIZATION: Throttled gesture velocity calculation
  const lastVelocityUpdate = useRef(0);
  const velocityUpdateThreshold = 16; // ~60fps throttling

  const updateGestureVelocity = useCallback((newX, newY, timestamp) => {
    // Throttle velocity calculations to 60fps
    if (timestamp - lastVelocityUpdate.current < velocityUpdateThreshold) {
      return;
    }
    lastVelocityUpdate.current = timestamp;

    if (gestureHistory.length > 0) {
      const lastGesture = gestureHistory[gestureHistory.length - 1];
      const deltaTime = timestamp - lastGesture.timestamp;
      if (deltaTime > 0) {
        const velocityX = (newX - lastGesture.x) / deltaTime;
        const velocityY = (newY - lastGesture.y) / deltaTime;
        setGestureVelocity({ x: velocityX, y: velocityY });
      }
    }

    // Update gesture history (keep last 3 points for performance)
    setGestureHistory(prev => [
      ...prev.slice(-2), // Reduced from -4 to -2 for better performance
      { x: newX, y: newY, timestamp }
    ]);
  }, [gestureHistory]);

  // Enhanced precision mode for fine adjustments
  const applyPrecisionMode = useCallback((delta) => {
    if (!precisionMode) return delta;
    return delta * 0.3; // Reduce movement by 70% in precision mode
  }, [precisionMode]);

  // Enhanced drag functions with snap-to-grid and precision mode
  const beginDrag = useCallback((id, e) => {
    const l = layers.find(x => x.id === id);
    if (l.lock) return;
    e.preventDefault();
    e.stopPropagation();
    const coords = getEventCoords(e);
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      const timestamp = Date.now();
      setDragging({
        id,
        offsetX: coords.clientX - rect.left - l.x,
        offsetY: coords.clientY - rect.top - l.y,
        startTime: timestamp,
        initialX: l.x,
        initialY: l.y
      });
      setTouchState(prev => ({
        ...prev,
        gestureType: 'drag',
        gestureStartTime: timestamp,
        isGesturing: true
      }));
      setGestureHistory([{ x: l.x, y: l.y, timestamp }]);
    }
  }, [layers, stageRef, getEventCoords]);

  // PERFORMANCE OPTIMIZATION: Throttled drag updates using requestAnimationFrame
  const dragUpdateRef = useRef(null);
  const pendingDragUpdate = useRef(null);

  const onDrag = useCallback((e) => {
    if (!dragging) return;

    // Store the latest event data
    pendingDragUpdate.current = {
      coords: getEventCoords(e),
      timestamp: Date.now()
    };

    // Throttle updates using requestAnimationFrame for smooth 60fps
    if (!dragUpdateRef.current) {
      dragUpdateRef.current = requestAnimationFrame(() => {
        if (!pendingDragUpdate.current || !dragging) {
          dragUpdateRef.current = null;
          return;
        }

        const { coords, timestamp } = pendingDragUpdate.current;
        const rect = stageRef.current?.getBoundingClientRect();

        if (rect) {
          let newX = coords.clientX - rect.left - dragging.offsetX;
          let newY = coords.clientY - rect.top - dragging.offsetY;

          // Apply precision mode
          if (precisionMode) {
            const deltaX = newX - dragging.initialX;
            const deltaY = newY - dragging.initialY;
            newX = dragging.initialX + applyPrecisionMode(deltaX);
            newY = dragging.initialY + applyPrecisionMode(deltaY);
          }

          // Apply snap to grid
          const snappedCoords = snapToGridCoords(newX, newY);
          newX = snappedCoords.x;
          newY = snappedCoords.y;

          // Update velocity tracking (already throttled internally)
          updateGestureVelocity(newX, newY, timestamp);

          // Batch state updates for better performance
          setLayers(ls => ls.map(l => l.id === dragging.id ? {
            ...l,
            x: newX,
            y: newY
          } : l));

          setTouchState(prev => ({
            ...prev,
            lastGestureUpdate: timestamp
          }));
        }

        dragUpdateRef.current = null;
        pendingDragUpdate.current = null;
      });
    }
  }, [dragging, stageRef, setLayers, getEventCoords, precisionMode, applyPrecisionMode, snapToGridCoords, updateGestureVelocity]);

  const endDrag = useCallback(() => {
    // PERFORMANCE OPTIMIZATION: Cancel pending animation frame
    if (dragUpdateRef.current) {
      cancelAnimationFrame(dragUpdateRef.current);
      dragUpdateRef.current = null;
    }
    pendingDragUpdate.current = null;

    setDragging(null);
    setTouchState(prev => ({
      ...prev,
      gestureType: null,
      isGesturing: false,
      gestureStartTime: null
    }));
    setGestureHistory([]);
    setGestureVelocity({ x: 0, y: 0 });
  }, []);

  // Enhanced rotation functions with angle snapping and precision
  const startRotate = useCallback((id, e) => {
    const l = layers.find(x => x.id === id);
    if (l.lock) return;
    e.stopPropagation();
    const timestamp = Date.now();
    setRotating({
      id,
      initialRotation: l.rot,
      startTime: timestamp
    });
    setTouchState(prev => ({
      ...prev,
      gestureType: 'rotate',
      gestureStartTime: timestamp,
      isGesturing: true
    }));
  }, [layers]);

  // PERFORMANCE OPTIMIZATION: Throttled rotation updates
  const rotateUpdateRef = useRef(null);
  const pendingRotateUpdate = useRef(null);

  const doRotate = useCallback((e) => {
    if (!rotating || !stageRef.current) return;

    // Store the latest event data
    pendingRotateUpdate.current = {
      coords: getEventCoords(e),
      timestamp: Date.now()
    };

    // Throttle updates using requestAnimationFrame
    if (!rotateUpdateRef.current) {
      rotateUpdateRef.current = requestAnimationFrame(() => {
        if (!pendingRotateUpdate.current || !rotating) {
          rotateUpdateRef.current = null;
          return;
        }

        const l = layers.find(x => x.id === rotating.id);
        if (!l) {
          rotateUpdateRef.current = null;
          return;
        }

        const rect = stageRef.current.getBoundingClientRect();
        const { coords, timestamp } = pendingRotateUpdate.current;
        const x = coords.clientX - rect.left, y = coords.clientY - rect.top;

        // OPTIMIZED: Pre-calculate center using actual layer dimensions
        const centerX = l.x + 50; // Could be optimized with actual layer size
        const centerY = l.y + 50;

        // OPTIMIZED: Use faster angle calculation
        let angle = Math.atan2(y - centerY, x - centerX) * 57.29577951308232 + 90; // 180/PI pre-calculated

        // Apply precision mode (smaller increments)
        if (precisionMode) {
          const deltaAngle = angle - rotating.initialRotation;
          angle = rotating.initialRotation + applyPrecisionMode(deltaAngle);
        }

        // OPTIMIZED: Faster angle snapping
        const snapAngle = Math.round(angle * 0.06666666666666667) * 15; // 1/15 pre-calculated
        if (Math.abs(angle - snapAngle) < 5) {
          angle = snapAngle;
        }

        // OPTIMIZED: Faster angle normalization
        angle = angle < 0 ? angle + 360 : (angle >= 360 ? angle - 360 : angle);

        setLayers(ls => ls.map(x => x.id === l.id ? { ...x, rot: angle } : x));

        setTouchState(prev => ({
          ...prev,
          lastGestureUpdate: timestamp
        }));

        rotateUpdateRef.current = null;
        pendingRotateUpdate.current = null;
      });
    }
  }, [rotating, layers, stageRef, setLayers, getEventCoords, precisionMode, applyPrecisionMode]);

  const endRotate = useCallback(() => {
    // PERFORMANCE OPTIMIZATION: Cancel pending animation frame
    if (rotateUpdateRef.current) {
      cancelAnimationFrame(rotateUpdateRef.current);
      rotateUpdateRef.current = null;
    }
    pendingRotateUpdate.current = null;

    setRotating(null);
    setTouchState(prev => ({
      ...prev,
      gestureType: null,
      isGesturing: false,
      gestureStartTime: null
    }));
  }, []);

  // Enhanced resize functions with proportional scaling and precision
  const startResize = useCallback((id, e) => {
    const l = layers.find(x => x.id === id);
    if (l.lock) return;
    e.stopPropagation();
    const coords = getEventCoords(e);
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = l.x + 50;
      const centerY = l.y + 50;
      const initialDistance = Math.hypot(
        coords.clientX - rect.left - centerX,
        coords.clientY - rect.top - centerY
      );
      const timestamp = Date.now();

      setResizing({
        id,
        initialDistance,
        initialScale: l.scale,
        centerX,
        centerY,
        startTime: timestamp
      });
      setTouchState(prev => ({
        ...prev,
        gestureType: 'resize',
        gestureStartTime: timestamp,
        isGesturing: true
      }));
    }
  }, [layers, getEventCoords, stageRef]);

  const doResize = useCallback((e) => {
    if (!resizing || !stageRef.current) return;
    const l = layers.find(x => x.id === resizing.id);
    const rect = stageRef.current.getBoundingClientRect();
    const coords = getEventCoords(e);

    const currentDistance = Math.hypot(
      coords.clientX - rect.left - resizing.centerX,
      coords.clientY - rect.top - resizing.centerY
    );

    let scaleFactor = (currentDistance / resizing.initialDistance) * resizing.initialScale;

    // Apply precision mode
    if (precisionMode) {
      const deltaScale = scaleFactor - resizing.initialScale;
      scaleFactor = resizing.initialScale + applyPrecisionMode(deltaScale);
    }

    // Constrain scale to reasonable bounds
    scaleFactor = Math.max(0.1, Math.min(10, scaleFactor));

    // Snap to common scale values (0.5, 1.0, 1.5, 2.0, etc.)
    const snapScales = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
    const closestSnap = snapScales.reduce((prev, curr) =>
      Math.abs(curr - scaleFactor) < Math.abs(prev - scaleFactor) ? curr : prev
    );
    if (Math.abs(scaleFactor - closestSnap) < 0.1) {
      scaleFactor = closestSnap;
    }

    setLayers(ls => ls.map(x => x.id === l.id ? { ...x, scale: scaleFactor } : x));

    setTouchState(prev => ({
      ...prev,
      lastGestureUpdate: Date.now()
    }));
  }, [resizing, layers, stageRef, setLayers, getEventCoords, precisionMode, applyPrecisionMode]);

  const endResize = useCallback(() => {
    setResizing(null);
    setTouchState(prev => ({
      ...prev,
      gestureType: null,
      isGesturing: false,
      gestureStartTime: null
    }));
  }, []);

  // Advanced multi-touch gesture handling
  const handleMultiTouch = useCallback((touches, activeLayerId) => {
    if (touches.length !== 2 || !activeLayerId) return;

    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer || layer.lock) return;

    const touch1 = touches[0];
    const touch2 = touches[1];
    const distance = calculateDistance(touch1, touch2);
    const rotation = calculateRotation(touch1, touch2);
    const center = calculateCenter(touch1, touch2);

    if (touchState.initialDistance && touchState.gestureType === 'multi') {
      // Calculate scale change
      const scaleChange = distance / touchState.initialDistance;
      const newScale = Math.max(0.1, Math.min(10, touchState.initialScale * scaleChange));

      // Calculate rotation change
      const rotationChange = rotation - touchState.initialRotation;
      const newRotation = ((layer.rot + rotationChange) % 360 + 360) % 360;

      setLayers(ls => ls.map(l => l.id === activeLayerId ? {
        ...l,
        scale: newScale,
        rot: newRotation
      } : l));
    } else {
      // Initialize multi-touch gesture
      setTouchState({
        touches,
        initialDistance: distance,
        initialScale: layer.scale,
        initialRotation: rotation,
        gestureType: 'multi',
        gestureStartTime: Date.now(),
        isGesturing: true,
        lastGestureUpdate: Date.now()
      });
    }
  }, [layers, setLayers, touchState, calculateDistance, calculateRotation, calculateCenter]);

  // Gesture control functions
  const toggleSnapToGrid = useCallback(() => {
    setSnapToGrid(prev => !prev);
  }, []);

  const togglePrecisionMode = useCallback(() => {
    setPrecisionMode(prev => !prev);
  }, []);

  const toggleMeasurements = useCallback(() => {
    setShowMeasurements(prev => !prev);
  }, []);

  return {
    // Core gesture state
    dragging, rotating, resizing, touchState, setTouchState,

    // Basic gesture functions
    beginDrag, onDrag, endDrag,
    startRotate, doRotate, endRotate,
    startResize, doResize, endResize,

    // Advanced gesture functions
    handleMultiTouch,

    // Helper functions
    calculateDistance, calculateRotation, calculateCenter, getEventCoords,

    // Advanced features
    snapToGrid, toggleSnapToGrid,
    precisionMode, togglePrecisionMode,
    showMeasurements, toggleMeasurements,
    gestureVelocity, gestureHistory,

    // Grid and snap utilities
    snapToGridCoords, gridSize, snapThreshold
  };
}

/**
 * Custom hook for managing SVG layers and processing
 * Preserves all existing SVG handling and layer management logic
 */
function useSVGLayers(simpleMode, pxPerMM) {
  const [layers, setLayers] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const activeLayer = useMemo(() => layers.find(l => l.id === activeId) || null, [layers, activeId]);

  // Parse SVG dimensions from viewBox or width/height attributes
  const parseSVGDimensions = useCallback((svgText) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');

      if (!svg) return { originalWidth: 100, originalHeight: 100 };

      // Try viewBox first
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const [x, y, width, height] = viewBox.split(' ').map(Number);
        if (width && height) {
          return { originalWidth: width, originalHeight: height };
        }
      }

      // Fallback to width/height attributes
      const width = svg.getAttribute('width');
      const height = svg.getAttribute('height');
      if (width && height) {
        return {
          originalWidth: parseFloat(width.replace(/[^\d.]/g, '')) || 100,
          originalHeight: parseFloat(height.replace(/[^\d.]/g, '')) || 100
        };
      }

      return { originalWidth: 100, originalHeight: 100 };
    } catch (e) {
      console.error('Error parsing SVG dimensions:', e);
      return { originalWidth: 100, originalHeight: 100 };
    }
  }, []);

  // Add SVG layer from file or library
  const addSVGLayer = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const blob = new Blob([text], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const dimensions = parseSVGDimensions(text);

      const newLayer = {
        id: Math.random().toString(36).slice(2),
        name: file.name.replace(/\.svg$/i, ""),
        svgText: text,
        url,
        x: 200,
        y: 200,
        rot: 0,
        heightMM: dimensions.originalHeight,
        scale: 1,
        opacity: 1,
        lock: false,
        originalWidth: dimensions.originalWidth,
        originalHeight: dimensions.originalHeight
      };

      if (simpleMode) {
        setLayers([newLayer]);
        setActiveId(newLayer.id);
      } else {
        setLayers(ls => [...ls, newLayer]);
        setActiveId(newLayer.id);
      }
    };
    reader.readAsText(file);
  }, [simpleMode, parseSVGDimensions]);

  // Add SVG layer directly from SVG text (for library items)
  const addSVGFromText = useCallback((svgText, name) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const dimensions = parseSVGDimensions(svgText);

    const newLayer = {
      id: Math.random().toString(36).slice(2),
      name: name || "Library SVG",
      svgText,
      url,
      x: 200,
      y: 200,
      rot: 0,
      heightMM: dimensions.originalHeight,
      scale: 1,
      opacity: 1,
      lock: false,
      originalWidth: dimensions.originalWidth,
      originalHeight: dimensions.originalHeight
    };

    if (simpleMode) {
      setLayers([newLayer]);
      setActiveId(newLayer.id);
    } else {
      setLayers(ls => [...ls, newLayer]);
      setActiveId(newLayer.id);
    }
  }, [simpleMode, parseSVGDimensions]);

  // Layer sizing with aspect ratio preservation
  const layerSizePX = useCallback((layer) => {
    const aspectRatio = (layer.originalWidth && layer.originalHeight) ?
      layer.originalWidth / layer.originalHeight : 1;
    const hpx = (pxPerMM ? pxPerMM : 1) * layer.heightMM * layer.scale;
    const wpx = hpx * aspectRatio;
    return { wpx, hpx };
  }, [pxPerMM]);

  // Real-time dimension feedback
  const getDimensionFeedback = useCallback((layer) => {
    if (!layer || !layer.originalWidth || !layer.originalHeight) {
      return {
        original: "Unknown",
        current: `${Math.round(layer?.heightMM || 0)}×${Math.round(layer?.heightMM || 0)}mm`,
        scale: `${Math.round((layer?.scale || 1) * 100)}%`
      };
    }

    const currentWidth = Math.round(layer.originalWidth * layer.scale);
    const currentHeight = Math.round(layer.originalHeight * layer.scale);

    return {
      original: `${layer.originalWidth}×${layer.originalHeight}mm`,
      current: `${currentWidth}×${currentHeight}mm`,
      scale: `${Math.round(layer.scale * 100)}%`
    };
  }, []);

  // PERFORMANCE OPTIMIZATION: SVG Memory Leak Prevention
  // Cleanup blob URLs when layers change or component unmounts
  useEffect(() => {
    return () => {
      // Cleanup all blob URLs when component unmounts
      layers.forEach(layer => {
        if (layer.url && layer.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(layer.url);
          } catch (error) {
            console.warn('Failed to revoke blob URL:', error);
          }
        }
      });
    };
  }, []); // Only run on unmount

  // Cleanup removed layers when layers array changes
  const prevLayersRef = useRef([]);
  useEffect(() => {
    const prevLayers = prevLayersRef.current;
    const currentLayerIds = new Set(layers.map(l => l.id));

    // Find removed layers and cleanup their blob URLs
    prevLayers.forEach(prevLayer => {
      if (!currentLayerIds.has(prevLayer.id) && prevLayer.url && prevLayer.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prevLayer.url);
        } catch (error) {
          console.warn('Failed to revoke blob URL for removed layer:', error);
        }
      }
    });

    // Update ref for next comparison
    prevLayersRef.current = layers;
  }, [layers]);

  return {
    layers, setLayers, activeId, setActiveId, activeLayer,
    addSVGLayer, addSVGFromText, layerSizePX, getDimensionFeedback, parseSVGDimensions
  };
}

/**
 * Custom hook for managing calibration system
 * Preserves all existing calibration logic and accuracy
 */
function useCalibration() {
  const [calibPoints, setCalibPoints] = useState([]);
  const [calibDistanceMM, setCalibDistanceMM] = useState("");
  const [pxPerMM, setPxPerMM] = useState(null);

  const calibPX = useMemo(() => {
    return calibPoints.length === 2 ?
      Math.hypot(calibPoints[0].x - calibPoints[1].x, calibPoints[0].y - calibPoints[1].y) : null;
  }, [calibPoints]);

  useEffect(() => {
    if (calibPX && calibDistanceMM && calibDistanceMM > 0) {
      setPxPerMM(calibPX / Number(calibDistanceMM));
    }
  }, [calibPX, calibDistanceMM]);

  const addCalibPoint = useCallback((x, y) => {
    let pts = [...calibPoints, { x, y }];
    if (pts.length > 2) pts = pts.slice(-2);
    setCalibPoints(pts);
  }, [calibPoints]);

  const resetCalibration = useCallback(() => {
    setCalibPoints([]);
    setPxPerMM(null);
  }, []);

  return {
    calibPoints, setCalibPoints, calibDistanceMM, setCalibDistanceMM,
    pxPerMM, setPxPerMM, calibPX, addCalibPoint, resetCalibration
  };
}

/**
 * Enhanced camera integration hook for AR overlay
 * Provides comprehensive camera controls, permissions, and error handling
 */
function useCamera() {
  // Core camera state
  const [useCamera, setUseCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [bgImage, setBgImage] = useState(null);
  const [bgImageFit, setBgImageFit] = useState({ w: 0, h: 0, x: 0, y: 0 });
  const videoRef = useRef(null);

  // Enhanced camera state
  const [cameraError, setCameraError] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' for front, 'environment' for back
  const [flashMode, setFlashMode] = useState(false);
  const [photoQuality, setPhotoQuality] = useState(90);
  const [availableCameras, setAvailableCameras] = useState([]);

  // Check camera permissions and available devices
  const checkCameraCapabilities = useCallback(async () => {
    try {
      // Check permissions
      const permission = await navigator.permissions.query({ name: 'camera' });
      setPermissionState(permission.state);

      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);

      return { permission: permission.state, cameras };
    } catch (e) {
      console.error("Camera capability check failed", e);
      setCameraError("Camera not supported on this device");
      return { permission: 'denied', cameras: [] };
    }
  }, []);

  // Enhanced camera stream management with better error handling
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (useCamera) {
        // Prevent multiple simultaneous initializations
        if (isLoading) return;

        setIsLoading(true);
        setCameraError(null);

        try {
          // Check capabilities first
          const { permission } = await checkCameraCapabilities();

          if (permission === 'denied') {
            throw new Error('Camera permission denied');
          }

          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: false
          };

          const s = await navigator.mediaDevices.getUserMedia(constraints);

          if (!mounted) {
            s.getTracks().forEach(t => t.stop());
            return;
          }

          setStream(s);
          setPermissionState('granted');

          if (videoRef.current) {
            videoRef.current.srcObject = s;
            try {
              await videoRef.current.play();
            } catch (playError) {
              console.warn("Video play failed, retrying...", playError);
              // Retry after a short delay
              setTimeout(() => {
                if (videoRef.current && mounted) {
                  videoRef.current.play().catch(console.error);
                }
              }, 100);
            }
          }
        } catch (e) {
          console.error("Camera error", e);
          if (mounted) {
            setCameraError(e.message || "Failed to access camera");
            // Don't automatically disable camera on error - let user decide

            if (e.name === 'NotAllowedError') {
              setPermissionState('denied');
            }
          }
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      } else {
        // Clean up stream
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          setStream(null);
        }
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [useCamera, facingMode]); // Removed checkCameraCapabilities and stream to prevent loops

  // Enhanced photo capture with quality settings
  const capturePhoto = useCallback(async () => {
    try {
      setIsLoading(true);

      const res = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: photoQuality,
        allowEditing: false,
        correctOrientation: true
      });

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setBgImage(img);
        setUseCamera(false); // Switch to captured image
        setIsLoading(false);
      };
      img.onerror = () => {
        setCameraError("Failed to load captured image");
        setIsLoading(false);
      };
      img.src = res.webPath || res.path || "";
    } catch (e) {
      console.error("Photo capture error", e);
      setCameraError("Failed to capture photo");
      setIsLoading(false);
    }
  }, [photoQuality]);

  // Switch between front and back cameras
  const switchCamera = useCallback(() => {
    if (availableCameras.length > 1) {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    }
  }, [availableCameras]);

  // Toggle flash (for photo capture)
  const toggleFlash = useCallback(() => {
    setFlashMode(prev => !prev);
  }, []);

  // Photo picker with enhanced error handling
  const onPickPhoto = useCallback((file) => {
    if (!file) return;

    setIsLoading(true);
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      setBgImage(img);
      URL.revokeObjectURL(url);
      setUseCamera(false);
      setIsLoading(false);
    };

    img.onerror = () => {
      setCameraError("Failed to load selected image");
      URL.revokeObjectURL(url);
      setIsLoading(false);
    };

    img.src = url;
  }, []);

  // Request camera permission
  const requestCameraPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop()); // Stop immediately, just checking permission
      setPermissionState('granted');
      setCameraError(null);
      return true;
    } catch (e) {
      setPermissionState('denied');
      setCameraError("Camera permission required for AR mode");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear/Remove current background image
  const clearBackgroundImage = useCallback(() => {
    setBgImage(null);
    setBgImageFit({ w: 0, h: 0, x: 0, y: 0 });
    setUseCamera(false);
    setCameraError(null);
  }, []);

  // Get image source information
  const getImageSource = useCallback(() => {
    if (useCamera) return 'live_camera';
    if (bgImage) return 'photo';
    return 'none';
  }, [useCamera, bgImage]);

  return {
    // Core camera state
    useCamera, setUseCamera, stream, bgImage, setBgImage,
    bgImageFit, setBgImageFit, videoRef,

    // Enhanced camera state
    cameraError, setCameraError, permissionState, isLoading,
    facingMode, flashMode, photoQuality, availableCameras,

    // Camera actions
    capturePhoto, onPickPhoto, switchCamera, toggleFlash,
    requestCameraPermission, checkCameraCapabilities,

    // Image management
    clearBackgroundImage, getImageSource,

    // Settings
    setPhotoQuality, setFacingMode
  };
}

// ============================================================================
// BUILT-IN SVG LIBRARY - Professional sign elements collection
// ============================================================================

const SVG_LIBRARY = {
  numbers: {
    name: "Numbers",
    icon: "🔢",
    items: {
      "0": {
        name: "Zero",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10C70 10 85 25 85 50C85 75 70 90 50 90C30 90 15 75 15 50C15 25 30 10 50 10ZM50 25C38 25 30 33 30 50C30 67 38 75 50 75C62 75 70 67 70 50C70 33 62 25 50 25Z" fill="currentColor"/>
        </svg>`
      },
      "1": {
        name: "One",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M45 15L55 15L55 85L45 85L45 25L35 25L35 15L45 15Z" fill="currentColor"/>
        </svg>`
      },
      "2": {
        name: "Two",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 25C20 15 30 10 50 10C70 10 80 15 80 25C80 35 70 40 50 45L20 70L20 85L80 85L80 75L35 75L65 50C75 45 80 35 80 25C80 10 65 0 50 0C35 0 20 10 20 25Z" fill="currentColor"/>
        </svg>`
      },
      "3": {
        name: "Three",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 25C20 15 30 10 50 10C70 10 80 15 80 25C80 35 75 40 65 42.5C75 45 80 50 80 60C80 75 70 85 50 85C30 85 20 75 20 60L30 60C30 70 38 75 50 75C62 75 70 70 70 60C70 50 62 45 50 45L45 45L45 35L50 35C62 35 70 30 70 25C70 20 62 15 50 15C38 15 30 20 30 25L20 25Z" fill="currentColor"/>
        </svg>`
      },
      "4": {
        name: "Four",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M60 10L60 55L80 55L80 65L60 65L60 85L50 85L50 65L15 65L15 55L50 10L60 10ZM50 25L25 55L50 55L50 25Z" fill="currentColor"/>
        </svg>`
      },
      "5": {
        name: "Five",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 10L80 10L80 20L30 20L30 40L50 40C70 40 80 50 80 65C80 80 70 90 50 90C30 90 20 80 20 65L30 65C30 75 38 80 50 80C62 80 70 75 70 65C70 55 62 50 50 50L20 50L20 10Z" fill="currentColor"/>
        </svg>`
      },
      "6": {
        name: "Six",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10C30 10 15 25 15 50C15 75 30 90 50 90C70 90 85 75 85 65C85 55 75 50 60 50C45 50 35 55 30 65C30 40 38 25 50 25C62 25 70 30 75 40L85 35C80 20 65 10 50 10ZM50 60C62 60 70 65 70 75C70 85 62 90 50 90C38 90 30 85 30 75C30 65 38 60 50 60Z" fill="currentColor"/>
        </svg>`
      },
      "7": {
        name: "Seven",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 10L85 10L85 20L30 85L20 85L75 20L15 20L15 10Z" fill="currentColor"/>
        </svg>`
      },
      "8": {
        name: "Eight",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10C70 10 80 20 80 30C80 40 75 45 65 47.5C75 50 80 55 80 65C80 80 70 90 50 90C30 90 20 80 20 65C20 55 25 50 35 47.5C25 45 20 40 20 30C20 20 30 10 50 10ZM50 20C38 20 30 25 30 30C30 35 38 40 50 40C62 40 70 35 70 30C70 25 62 20 50 20ZM50 50C38 50 30 55 30 65C30 75 38 80 50 80C62 80 70 75 70 65C70 55 62 50 50 50Z" fill="currentColor"/>
        </svg>`
      },
      "9": {
        name: "Nine",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10C70 10 85 25 85 35C85 45 75 50 60 50C45 50 35 45 30 35C30 60 38 75 50 75C62 75 70 70 75 60L85 65C80 80 65 90 50 90C30 90 15 75 15 50C15 25 30 10 50 10ZM50 20C38 20 30 25 30 35C30 45 38 50 50 50C62 50 70 45 70 35C70 25 62 20 50 20Z" fill="currentColor"/>
        </svg>`
      }
    }
  },
  letters: {
    name: "Letters",
    icon: "🔤",
    items: {
      "A": {
        name: "Letter A",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10L65 85L55 85L52 70L48 70L45 85L35 85L50 10ZM50 30L47 60L53 60L50 30Z" fill="currentColor"/>
        </svg>`
      },
      "B": {
        name: "Letter B",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 10L60 10C75 10 80 20 80 30C80 40 75 45 65 47.5C75 50 80 55 80 65C80 80 70 85 55 85L20 85L20 10ZM30 20L30 40L55 40C65 40 70 35 70 30C70 25 65 20 55 20L30 20ZM30 50L30 75L55 75C65 75 70 70 70 65C70 60 65 55 55 55L30 50Z" fill="currentColor"/>
        </svg>`
      },
      "C": {
        name: "Letter C",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10C70 10 85 25 85 50C85 75 70 90 50 90C30 90 15 75 15 50C15 25 30 10 50 10ZM50 20C35 20 25 30 25 50C25 70 35 80 50 80C65 80 75 70 75 50C75 30 65 20 50 20Z" fill="currentColor"/>
        </svg>`
      },
      "EXIT": {
        name: "EXIT Sign",
        svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="80" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
          <text x="100" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="currentColor">EXIT</text>
        </svg>`
      },
      "ENTER": {
        name: "ENTER Sign",
        svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="80" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
          <text x="100" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="currentColor">ENTER</text>
        </svg>`
      },
      "OPEN": {
        name: "OPEN Sign",
        svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="80" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
          <text x="100" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="currentColor">OPEN</text>
        </svg>`
      },
      "CLOSED": {
        name: "CLOSED Sign",
        svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="80" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
          <text x="100" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="currentColor">CLOSED</text>
        </svg>`
      },
      "PUSH": {
        name: "PUSH Sign",
        svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="80" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
          <text x="100" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="currentColor">PUSH</text>
        </svg>`
      },
      "PULL": {
        name: "PULL Sign",
        svg: `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="80" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
          <text x="100" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="currentColor">PULL</text>
        </svg>`
      }
    }
  },
  shapes: {
    name: "Shapes",
    icon: "🔷",
    items: {
      "circle": {
        name: "Circle",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>`
      },
      "square": {
        name: "Square",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="15" y="15" width="70" height="70" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>`
      },
      "triangle": {
        name: "Triangle",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 15L85 85L15 85Z" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>`
      },
      "diamond": {
        name: "Diamond",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 15L85 50L50 85L15 50Z" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>`
      },
      "star": {
        name: "Star",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 15L55 35L75 35L60 50L65 70L50 60L35 70L40 50L25 35L45 35Z" fill="currentColor"/>
        </svg>`
      },
      "hexagon": {
        name: "Hexagon",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 25L70 25L85 50L70 75L30 75L15 50Z" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>`
      }
    }
  },
  arrows: {
    name: "Arrows",
    icon: "➡️",
    items: {
      "arrow-right": {
        name: "Arrow Right",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 45L70 45L70 35L85 50L70 65L70 55L20 55Z" fill="currentColor"/>
        </svg>`
      },
      "arrow-left": {
        name: "Arrow Left",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M80 45L30 45L30 35L15 50L30 65L30 55L80 55Z" fill="currentColor"/>
        </svg>`
      },
      "arrow-up": {
        name: "Arrow Up",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M45 80L45 30L35 30L50 15L65 30L55 30L55 80Z" fill="currentColor"/>
        </svg>`
      },
      "arrow-down": {
        name: "Arrow Down",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M45 20L45 70L35 70L50 85L65 70L55 70L55 20Z" fill="currentColor"/>
        </svg>`
      },
      "curved-arrow": {
        name: "Curved Arrow",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 50C20 30 35 15 55 15C75 15 85 25 85 40L75 40C75 30 70 25 55 25C40 25 30 35 30 50C30 65 40 75 55 75L55 65L75 80L55 95L55 85C30 85 20 70 20 50Z" fill="currentColor"/>
        </svg>`
      }
    }
  },
  symbols: {
    name: "Symbols",
    icon: "⚠️",
    items: {
      "checkmark": {
        name: "Checkmark",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 50L35 65L80 20L85 25L35 75L15 55Z" fill="currentColor"/>
        </svg>`
      },
      "cross": {
        name: "Cross",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M25 25L75 75M75 25L25 75" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
        </svg>`
      },
      "warning": {
        name: "Warning",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10L85 85L15 85Z" fill="none" stroke="currentColor" stroke-width="4"/>
          <circle cx="50" cy="70" r="3" fill="currentColor"/>
          <path d="M50 35L50 60" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        </svg>`
      },
      "info": {
        name: "Information",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="4"/>
          <circle cx="50" cy="35" r="3" fill="currentColor"/>
          <path d="M50 45L50 70" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        </svg>`
      },
      "plus": {
        name: "Plus",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 20L50 80M20 50L80 50" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
        </svg>`
      },
      "minus": {
        name: "Minus",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 50L80 50" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
        </svg>`
      }
    }
  },
  wayfinding: {
    name: "Wayfinding",
    icon: "🚪",
    items: {
      "restroom-men": {
        name: "Men's Restroom",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="20" r="8" fill="currentColor"/>
          <rect x="45" y="30" width="10" height="25" fill="currentColor"/>
          <rect x="40" y="35" width="20" height="8" fill="currentColor"/>
          <rect x="45" y="55" width="10" height="25" fill="currentColor"/>
          <rect x="35" y="70" width="12" height="8" fill="currentColor"/>
          <rect x="53" y="70" width="12" height="8" fill="currentColor"/>
        </svg>`
      },
      "restroom-women": {
        name: "Women's Restroom",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="20" r="8" fill="currentColor"/>
          <rect x="45" y="30" width="10" height="15" fill="currentColor"/>
          <path d="M35 45L65 45L60 65L40 65Z" fill="currentColor"/>
          <rect x="45" y="65" width="10" height="15" fill="currentColor"/>
          <rect x="35" y="70" width="12" height="8" fill="currentColor"/>
          <rect x="53" y="70" width="12" height="8" fill="currentColor"/>
        </svg>`
      },
      "elevator": {
        name: "Elevator",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="15" width="60" height="70" fill="none" stroke="currentColor" stroke-width="4"/>
          <path d="M40 35L50 25L60 35" fill="none" stroke="currentColor" stroke-width="3"/>
          <path d="M40 65L50 75L60 65" fill="none" stroke="currentColor" stroke-width="3"/>
        </svg>`
      },
      "stairs": {
        name: "Stairs",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 80L30 80L30 70L40 70L40 60L50 60L50 50L60 50L60 40L70 40L70 30L80 30" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>`
      },
      "parking": {
        name: "Parking",
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="15" y="15" width="70" height="70" fill="none" stroke="currentColor" stroke-width="4"/>
          <text x="50" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="currentColor">P</text>
        </svg>`
      }
    }
  }
};

// ============================================================================
// AR LAYOUT COMPONENTS - New full-screen overlay architecture
// ============================================================================

/**
 * AR Navigation Bar - Professional branding with accuracy indicators
 * Mobile-optimized with responsive design for Samsung Galaxy S20+ portrait mode
 */
function ARNavigationBar({ pxPerMM, projectName, onMenuToggle, onProjectManager, onSaveProject, onAdvancedExport, logger, isMobile }) {
  const handleMenuToggle = () => {
    logger?.logUserAction('navigation_menu_toggle', { action: 'open_settings' });
    onMenuToggle();
  };

  const handleProjectManager = () => {
    logger?.logUserAction('navigation_project_manager', { action: 'open_project_manager' });
    onProjectManager();
  };

  const handleSaveProject = () => {
    logger?.logUserAction('navigation_save_project', { project_name: projectName });
    onSaveProject();
  };

  const handleAdvancedExport = () => {
    logger?.logUserAction('navigation_advanced_export', { action: 'open_export_panel' });
    onAdvancedExport();
  };

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-sm border-b border-white/10">
      <div className={`flex items-center justify-between ${isMobile ? 'p-2 px-3' : 'p-4'}`}>
        {/* Logo and Branding - Mobile Optimized */}
        <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
          <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg`}>
            <span className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-white`}>📐</span>
          </div>
          <div>
            <h1 className={`${isMobile ? 'text-sm' : 'text-xl'} font-bold tracking-tight text-white`}>
              {isMobile ? 'Laser Sign' : 'Laser Sign Visualizer'}
            </h1>
            <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-white/70 font-medium`}>AR Overlay Mode</p>
          </div>
        </div>

        {/* Project Management and Indicators - Mobile Optimized */}
        <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'}`}>
          {/* Current Project - Hidden on very small screens */}
          {!isMobile && (
            <div className="bg-black/40 px-3 py-1.5 rounded-full border border-white/20">
              <div className="text-white text-xs font-medium">{projectName}</div>
            </div>
          )}

          {/* Project Controls - Mobile Touch Optimized */}
          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-1'}`}>
            <button
              onClick={handleProjectManager}
              className={`${isMobile ? 'w-10 h-10 min-w-[44px] min-h-[44px]' : 'w-8 h-8'} rounded-lg bg-black/40 border border-white/20 text-white hover:bg-black/60 transition-all duration-200 flex items-center justify-center`}
              title="Projects"
            >
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              </svg>
            </button>

            <button
              onClick={handleSaveProject}
              className={`${isMobile ? 'w-10 h-10 min-w-[44px] min-h-[44px]' : 'w-8 h-8'} rounded-lg bg-black/40 border border-white/20 text-white hover:bg-black/60 transition-all duration-200 flex items-center justify-center`}
              title="Save"
            >
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>

            <button
              onClick={handleAdvancedExport}
              className={`${isMobile ? 'w-10 h-10 min-w-[44px] min-h-[44px]' : 'w-8 h-8'} rounded-lg bg-black/40 border border-white/20 text-white hover:bg-black/60 transition-all duration-200 flex items-center justify-center`}
              title="Export"
            >
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>

          {/* Accuracy Indicator - Responsive */}
          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'} text-xs text-white/80 bg-black/40 ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-full border border-white/20`}>
            <span className={`w-2 h-2 rounded-full ${pxPerMM ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            {!isMobile && <span>{pxPerMM ? 'Calibrated' : 'Not Calibrated'}</span>}
          </div>

          {/* Settings Menu - Mobile Touch Optimized */}
          <button
            onClick={handleMenuToggle}
            className={`${isMobile ? 'w-10 h-10 min-w-[44px] min-h-[44px]' : 'w-10 h-10'} rounded-lg bg-black/40 border border-white/20 text-white hover:bg-black/60 transition-all duration-200 flex items-center justify-center`}
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

/**
 * AR Bottom Controls - Three-button system for core functions
 * Mobile-optimized with responsive design for Samsung Galaxy S20+ portrait mode
 */
function ARBottomControls({
  onSVGSelect,
  onCameraOptions,
  onCapture,
  hasLayers,
  useCamera,
  disabled = false,
  logger,
  isMobile
}) {
  const handleSVGSelect = () => {
    logger?.logUserAction('bottom_controls_svg_select', { action: 'open_svg_library' });
    onSVGSelect();
  };

  const handleCameraOptions = () => {
    logger?.logUserAction('bottom_controls_camera_options', { action: 'open_camera_options' });
    onCameraOptions();
  };

  const handleCapture = () => {
    logger?.logUserAction('bottom_controls_capture', {
      action: 'capture_photo',
      has_layers: hasLayers,
      use_camera: useCamera
    });
    onCapture();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-sm border-t border-white/10">
      {/* Safe area padding for mobile devices */}
      <div className={`flex justify-center items-center ${isMobile ? 'gap-3 p-4 pb-6' : 'gap-6 p-6'}`}>
        {/* SVG Select Button - Mobile Touch Optimized */}
        <button
          onClick={handleSVGSelect}
          disabled={disabled}
          className={`flex flex-col items-center gap-2 ${isMobile ? 'px-4 py-3 min-w-[80px] min-h-[60px]' : 'px-6 py-4 min-w-[100px]'} rounded-2xl bg-blue-600/80 hover:bg-blue-600 border border-blue-400/50 text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Select SVG"
        >
          <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
          </svg>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>SVG Select</span>
        </button>

        {/* Camera Options Button - Mobile Touch Optimized */}
        <button
          onClick={handleCameraOptions}
          disabled={disabled}
          className={`flex flex-col items-center gap-2 ${isMobile ? 'px-4 py-3 min-w-[80px] min-h-[60px]' : 'px-6 py-4 min-w-[100px]'} rounded-2xl bg-purple-600/80 hover:bg-purple-600 border border-purple-400/50 text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Camera Options"
        >
          <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>Camera</span>
        </button>

        {/* Capture/Save Button - Context sensitive & Mobile Touch Optimized */}
        <button
          onClick={handleCapture}
          disabled={disabled || !hasLayers}
          className={`flex flex-col items-center gap-2 ${isMobile ? 'px-4 py-3 min-w-[80px] min-h-[60px]' : 'px-6 py-4 min-w-[100px]'} rounded-2xl border transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            hasLayers
              ? 'bg-emerald-600/80 hover:bg-emerald-600 border-emerald-400/50 text-white'
              : 'bg-gray-600/80 border-gray-400/50 text-gray-300'
          }`}
          title={hasLayers ? (useCamera ? "Capture" : "Save") : "Add SVG first"}
        >
          <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {useCamera ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            )}
          </svg>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
            {hasLayers ? (useCamera ? "Capture" : "Save") : "Capture"}
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Enhanced AR Camera Background with loading states and error handling
 */
function ARCameraBackground({
  useCamera,
  videoRef,
  bgImage,
  bgImageFit,
  isLoading,
  cameraError,
  permissionState,
  onRequestPermission,
  onClearImage,
  onShowCameraOptions,
  isMobile = false
}) {
  console.log('ARCameraBackground rendering with:', {
    useCamera,
    bgImage: !!bgImage,
    isLoading,
    cameraError,
    permissionState
  });

  return (
    <div className="absolute inset-0 bg-black">
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg font-semibold">
              {useCamera ? "Starting Camera..." : "Loading Image..."}
            </div>
          </div>
        </div>
      )}

      {/* Camera Error State */}
      {cameraError && (
        <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center z-10">
          <div className="text-center text-white bg-black/80 p-8 rounded-2xl border border-red-500/50 max-w-md mx-4">
            <div className="text-4xl mb-4">⚠️</div>
            <div className="text-lg font-semibold mb-2">Camera Error</div>
            <div className="text-sm text-red-200 mb-4">{cameraError}</div>
            {permissionState === 'denied' && (
              <button
                onClick={onRequestPermission}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-semibold transition-all"
              >
                Grant Camera Permission
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Background Content */}
      {useCamera ? (
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{
              transform: 'scaleX(-1)', // Mirror front camera
              filter: 'brightness(1.1) contrast(1.05)' // Slight enhancement for AR
            }}
          />

          {/* Camera Info Overlay - Mobile positioned to avoid navigation overlap */}
          <div className={`absolute bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm ${isMobile ? 'top-16 left-2' : 'top-4 left-4'}`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>Live Camera</span>
            </div>
          </div>

          {/* Image Management Overlay Controls - Mobile positioned to avoid navigation overlap */}
          <div className={`absolute flex gap-2 ${isMobile ? 'top-16 right-2' : 'top-4 right-4'}`}>
            <button
              onClick={onShowCameraOptions}
              className="bg-black/50 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-black/70 transition-all"
              title="Camera Options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onClearImage}
              className="bg-red-500/50 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-red-500/70 transition-all"
              title="Clear Camera"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : bgImage ? (
        <div className="relative w-full h-full">
          <img
            src={bgImage.src}
            alt="background"
            className="w-full h-full object-cover"
            style={{
              filter: 'brightness(1.05) contrast(1.02)' // Slight enhancement
            }}
          />

          {/* Image Info Overlay - Mobile positioned to avoid navigation overlap */}
          <div className={`absolute bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm ${isMobile ? 'top-16 left-2' : 'top-4 left-4'}`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Photo Mode</span>
            </div>
          </div>

          {/* Image Management Overlay Controls - Mobile positioned to avoid navigation overlap */}
          <div className={`absolute flex gap-2 ${isMobile ? 'top-16 right-2' : 'top-4 right-4'}`}>
            <button
              onClick={onShowCameraOptions}
              className="bg-black/50 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-black/70 transition-all"
              title="Camera Options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onClearImage}
              className="bg-red-500/50 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-red-500/70 transition-all"
              title="Clear Photo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center text-white/80 max-w-md mx-4">
            <div className="text-6xl mb-6 opacity-60">📱</div>
            <div className="text-2xl font-bold mb-3">Laser Sign Visualizer</div>
            <div className="text-lg mb-6 text-white/70">
              Professional AR sign placement for Samsung Galaxy S20+
            </div>

            {permissionState === 'denied' ? (
              <div className="space-y-4">
                <div className="text-amber-400 text-sm bg-amber-900/20 p-3 rounded-lg border border-amber-500/30">
                  📷 Camera permission required for AR mode
                </div>
                <button
                  onClick={onRequestPermission}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-semibold transition-all shadow-lg"
                >
                  Enable Camera Access
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-white/60 space-y-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <div className="font-medium text-white/80 mb-2">Quick Start:</div>
                  <div>📷 Tap Camera Options to start live AR mode</div>
                  <div>📸 Or capture/load a photo to begin</div>
                  <div>🎨 Add SVG signs and calibrate for accuracy</div>
                </div>

                <button
                  onClick={onShowCameraOptions}
                  className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-semibold transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Start Camera
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Camera Options Panel - Comprehensive camera controls
 */
function CameraOptionsPanel({
  isOpen,
  onClose,
  camera,
  onStartCamera,
  onCapturePhoto,
  onPickPhoto
}) {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handlePickPhoto = () => {
    // Reset the input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      onPickPhoto(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Camera Options
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Camera Status */}
        <div className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-3 h-3 rounded-full ${
              camera.useCamera ? 'bg-emerald-500 animate-pulse' :
              camera.permissionState === 'granted' ? 'bg-blue-500' :
              camera.permissionState === 'denied' ? 'bg-red-500' : 'bg-amber-500'
            }`}></div>
            <span className="text-white font-medium">
              {camera.useCamera ? 'Live Camera Active' :
               camera.permissionState === 'granted' ? 'Camera Ready' :
               camera.permissionState === 'denied' ? 'Permission Denied' : 'Camera Standby'}
            </span>
          </div>

          {/* Image Source Indicator */}
          {(camera.useCamera || camera.bgImage) && (
            <div className="mb-3 p-2 rounded-lg bg-slate-700/50">
              <div className="text-xs text-slate-300">
                Current Source: {camera.getImageSource() === 'live_camera' ? 'Live Camera' :
                                camera.getImageSource() === 'photo' ? 'Photo' : 'None'}
              </div>
            </div>
          )}

          {camera.cameraError && (
            <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded-lg">
              {camera.cameraError}
            </div>
          )}
        </div>

        {/* Main Actions */}
        <div className="space-y-4 mb-6">
          {/* Live Camera Toggle */}
          <button
            onClick={() => {
              if (camera.useCamera) {
                camera.setUseCamera(false);
              } else {
                onStartCamera();
              }
            }}
            disabled={camera.isLoading || camera.permissionState === 'denied'}
            className={`w-full p-4 rounded-xl border-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              camera.useCamera
                ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                : 'border-slate-600 bg-slate-700/50 text-white hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div className="text-left">
                <div className="font-semibold">
                  {camera.useCamera ? 'Stop Live Camera' : 'Start Live Camera'}
                </div>
                <div className="text-sm opacity-75">
                  {camera.useCamera ? 'Switch to photo mode' : 'Real-time AR overlay'}
                </div>
              </div>
            </div>
          </button>

          {/* Capture Photo */}
          <button
            onClick={() => {
              onCapturePhoto();
              onClose();
            }}
            disabled={camera.isLoading}
            className="w-full p-4 rounded-xl border-2 border-slate-600 bg-slate-700/50 text-white hover:border-slate-500 transition-all duration-200 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="text-left">
                <div className="font-semibold">Capture New Photo</div>
                <div className="text-sm opacity-75">Take a photo for sign placement</div>
              </div>
            </div>
          </button>

          {/* Pick from Gallery */}
          <button
            onClick={handlePickPhoto}
            disabled={camera.isLoading}
            className="w-full p-4 rounded-xl border-2 border-slate-600 bg-slate-700/50 text-white hover:border-slate-500 transition-all duration-200 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-left">
                <div className="font-semibold">Choose from Gallery</div>
                <div className="text-sm opacity-75">Select existing photo</div>
              </div>
            </div>
          </button>

          {/* Alternative Gallery Access for Mobile */}
          <button
            onClick={async () => {
              try {
                const result = await Camera.getPhoto({
                  resultType: CameraResultType.Uri,
                  source: CameraSource.Photos,
                  quality: 90,
                  allowEditing: false,
                  correctOrientation: true
                });

                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  camera.setBgImage(img);
                  camera.setUseCamera(false);
                  onClose();
                };
                img.onerror = () => {
                  camera.setCameraError("Failed to load selected image");
                };
                img.src = result.webPath || result.path || "";
              } catch (error) {
                console.error("Gallery access error:", error);
                camera.setCameraError("Failed to access gallery");
              }
            }}
            disabled={camera.isLoading}
            className="w-full p-4 rounded-xl border-2 border-purple-600 bg-purple-700/50 text-white hover:border-purple-500 transition-all duration-200 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <div className="text-left">
                <div className="font-semibold">Mobile Gallery</div>
                <div className="text-sm opacity-75">Native photo picker</div>
              </div>
            </div>
          </button>
        </div>

        {/* Camera Settings */}
        {camera.availableCameras.length > 1 && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h3 className="text-white font-semibold">Camera Settings</h3>

            {/* Camera Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800">
              <div>
                <div className="text-white font-medium">Camera</div>
                <div className="text-slate-400 text-sm">
                  {camera.facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
                </div>
              </div>
              <button
                onClick={camera.switchCamera}
                disabled={camera.isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                Switch
              </button>
            </div>

            {/* Photo Quality */}
            <div className="p-3 rounded-lg bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-medium">Photo Quality</div>
                <div className="text-slate-400 text-sm">{camera.photoQuality}%</div>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="10"
                value={camera.photoQuality}
                onChange={(e) => camera.setPhotoQuality(Number(e.target.value))}
                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Image Management Controls */}
        {(camera.useCamera || camera.bgImage) && (
          <div className="mt-6 p-4 rounded-xl bg-red-900/20 border border-red-500/50">
            <h3 className="text-red-400 font-medium mb-3">Image Management</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  camera.clearBackgroundImage();
                  camera.setCameraError(null);
                }}
                disabled={camera.isLoading}
                className="w-full p-3 rounded-lg border-2 border-red-600 bg-red-700/50 text-white hover:border-red-500 transition-all duration-200 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Clear Image</div>
                    <div className="text-xs opacity-75">Remove current background</div>
                  </div>
                </div>
              </button>

              <div className="text-xs text-red-200 bg-red-900/30 p-2 rounded">
                This will remove the current {camera.getImageSource() === 'live_camera' ? 'live camera' : 'photo'} and return to camera selection.
              </div>
            </div>
          </div>
        )}

        {/* Permission Request */}
        {camera.permissionState === 'denied' && (
          <div className="mt-6 p-4 rounded-xl bg-amber-900/20 border border-amber-500/50">
            <div className="text-amber-400 font-medium mb-2">Camera Permission Required</div>
            <div className="text-amber-200 text-sm mb-3">
              Enable camera access in your browser settings to use AR mode.
            </div>
            <button
              onClick={camera.requestCameraPermission}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-white text-sm font-medium transition-all"
            >
              Request Permission
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

/**
 * Enhanced SVG Library Panel - Adaptive layout with collapsible categories
 * Optimized for Samsung Galaxy S20+ portrait mode
 */
function SVGLibraryPanel({
  isOpen,
  onClose,
  onSelectSVG,
  onUploadSVG,
  isMobile = false
}) {
  const [activeCategory, setActiveCategory] = useState('numbers');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSVGs, setRecentSVGs] = useState([]);
  const [showCategories, setShowCategories] = useState(!isMobile); // Collapsed by default on mobile
  const [expandedCategories, setExpandedCategories] = useState(new Set(['numbers'])); // Track expanded categories
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Filter SVGs based on search term
  const getFilteredSVGs = (category) => {
    const items = SVG_LIBRARY[category]?.items || {};
    if (!searchTerm) return items;

    return Object.fromEntries(
      Object.entries(items).filter(([key, item]) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        key.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  // Handle SVG selection from library
  const handleSVGSelect = (key, item) => {
    const svgBlob = new Blob([item.svg], { type: 'image/svg+xml' });
    const file = new File([svgBlob], `${item.name}.svg`, { type: 'image/svg+xml' });

    // Add to recent SVGs
    const recentItem = { key, ...item, category: activeCategory };
    setRecentSVGs(prev => {
      const filtered = prev.filter(r => r.key !== key || r.category !== activeCategory);
      return [recentItem, ...filtered].slice(0, 6); // Keep last 6
    });

    onSelectSVG(file);
    onClose();
  };

  // Handle custom SVG upload
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadSVG(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className={`bg-slate-900 rounded-2xl border border-slate-700 w-full ${isMobile ? 'h-[95vh]' : 'max-w-4xl h-[80vh]'} flex flex-col`}>
        {/* Header with Category Toggle */}
        <div className={`flex items-center justify-between ${isMobile ? 'p-4' : 'p-6'} border-b border-slate-700`}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setShowCategories(!showCategories)}
                className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all flex items-center justify-center"
              >
                {showCategories ? '📁' : '📂'}
              </button>
            )}
            <h2 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-white flex items-center gap-3`}>
              <svg className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              SVG Library
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`${isMobile ? 'w-12 h-12 min-w-[48px] min-h-[48px]' : 'w-10 h-10'} rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all flex items-center justify-center`}
          >
            ✕
          </button>
        </div>

        {/* Enhanced Search Bar with Quick Actions */}
        <div className={`${isMobile ? 'p-4' : 'p-6'} border-b border-slate-700`}>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search SVGs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 ${isMobile ? 'py-3' : 'py-3'} bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
            {isMobile && (
              <button
                onClick={() => setShowCategories(!showCategories)}
                className={`px-4 py-3 rounded-xl transition-all ${
                  showCategories
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                📁
              </button>
            )}
          </div>
        </div>

        <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
          {/* Adaptive Category Panel */}
          {(showCategories || !isMobile) && (
            <div className={`${isMobile ? 'border-b' : 'w-64 border-r'} border-slate-700 p-4 overflow-y-auto ${isMobile ? 'max-h-48' : ''}`}>
            <div className="space-y-2">
              {/* Recent SVGs */}
              {recentSVGs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <span>🕒</span> Recent
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {recentSVGs.map((item, index) => (
                      <button
                        key={`${item.category}-${item.key}-${index}`}
                        onClick={() => handleSVGSelect(item.key, item)}
                        className="aspect-square p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-all group"
                        title={item.name}
                      >
                        <div
                          className="w-full h-full text-slate-300 group-hover:text-white transition-colors"
                          dangerouslySetInnerHTML={{ __html: item.svg }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories - Collapsible on Mobile */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Categories</h3>
                {isMobile && (
                  <button
                    onClick={() => setExpandedCategories(prev =>
                      prev.size > 0 ? new Set() : new Set(Object.keys(SVG_LIBRARY))
                    )}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    {expandedCategories.size > 0 ? 'Collapse All' : 'Expand All'}
                  </button>
                )}
              </div>

              {Object.entries(SVG_LIBRARY).map(([key, category]) => (
                <div key={key} className="mb-2">
                  <button
                    onClick={() => {
                      if (isMobile) {
                        setExpandedCategories(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(key)) {
                            newSet.delete(key);
                          } else {
                            newSet.add(key);
                          }
                          return newSet;
                        });
                      }
                      setActiveCategory(key);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      activeCategory === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium">{category.name}</span>
                      <span className="ml-auto text-xs opacity-75">
                        {Object.keys(category.items).length}
                      </span>
                      {isMobile && (
                        <span className="text-xs">
                          {expandedCategories.has(key) ? '▼' : '▶'}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Quick Preview on Mobile */}
                  {isMobile && expandedCategories.has(key) && (
                    <div className="mt-2 ml-4 grid grid-cols-4 gap-2">
                      {Object.entries(category.items).slice(0, 8).map(([itemKey, item]) => (
                        <button
                          key={itemKey}
                          onClick={() => handleSVGSelect(itemKey, item)}
                          className="aspect-square p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-all"
                          title={item.name}
                        >
                          <div
                            className="w-full h-full text-slate-300 hover:text-white transition-colors"
                            dangerouslySetInnerHTML={{ __html: item.svg }}
                          />
                        </button>
                      ))}
                      {Object.keys(category.items).length > 8 && (
                        <button
                          onClick={() => {
                            setActiveCategory(key);
                            if (isMobile) setShowCategories(false);
                          }}
                          className="aspect-square p-2 bg-blue-800 hover:bg-blue-700 rounded-lg border border-blue-600 transition-all flex items-center justify-center text-xs text-white"
                        >
                          +{Object.keys(category.items).length - 8}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Upload Custom SVG */}
              <button
                onClick={handleUploadClick}
                className="w-full text-left p-3 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-emerald-200 transition-all duration-200 mt-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📁</span>
                  <span className="font-medium">Upload SVG</span>
                </div>
              </button>
            </div>
          </div>
          )}

          {/* Adaptive SVG Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Category Header with Mobile Optimization */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-white flex items-center gap-2`}>
                  <span>{SVG_LIBRARY[activeCategory]?.icon}</span>
                  {SVG_LIBRARY[activeCategory]?.name}
                </h3>
                {searchTerm && (
                  <p className="text-slate-400 text-sm mt-1">
                    Searching for "{searchTerm}"
                  </p>
                )}
              </div>
              {isMobile && !showCategories && (
                <button
                  onClick={() => setShowCategories(true)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
                >
                  Categories
                </button>
              )}
            </div>

            {/* Responsive SVG Grid */}
            <div className={`grid gap-3 ${
              isMobile
                ? 'grid-cols-3 sm:grid-cols-4'
                : 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
            }`}>
              {Object.entries(getFilteredSVGs(activeCategory)).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => handleSVGSelect(key, item)}
                  className={`aspect-square ${isMobile ? 'p-3 min-h-[60px]' : 'p-4'} bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 hover:border-slate-500 transition-all duration-200 group relative ${isMobile ? 'active:scale-95' : ''}`}
                  title={item.name}
                >
                  <div
                    className="w-full h-full text-slate-300 group-hover:text-white transition-colors"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                  <div className={`absolute bottom-1 left-1 right-1 ${isMobile ? 'text-xs' : 'text-xs'} text-slate-400 group-hover:text-slate-300 truncate`}>
                    {item.name}
                  </div>
                </button>
              ))}
            </div>

            {Object.keys(getFilteredSVGs(activeCategory)).length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-4">🔍</div>
                <div className="text-lg mb-2">No SVGs found</div>
                <div className="text-sm">Try a different search term or category</div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/svg+xml,image/svg-xml,text/xml,application/xml,.svg"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

/**
 * Comprehensive Application Logging System
 * Professional logging for debugging and user experience analysis
 */
function useApplicationLogger() {
  const [logs, setLogs] = useState([]);
  const [isLoggingEnabled, setIsLoggingEnabled] = useState(true);
  const maxLogEntries = 1000;

  // Log entry structure
  const createLogEntry = useCallback((type, action, details, status = 'success', error = null) => {
    return {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      type, // 'user', 'system', 'error', 'performance'
      action, // 'button_click', 'gesture', 'camera_operation', etc.
      details,
      status, // 'success', 'failure', 'warning', 'info'
      error: error?.message || error,
      sessionId: sessionStorage.getItem('laserSignSessionId') || 'unknown'
    };
  }, []);

  // Main logging function
  const log = useCallback((type, action, details, status = 'success', error = null) => {
    if (!isLoggingEnabled) return;

    const entry = createLogEntry(type, action, details, status, error);

    setLogs(prev => {
      const newLogs = [entry, ...prev];
      // Keep only the most recent entries
      const trimmedLogs = newLogs.slice(0, maxLogEntries);

      // Persist to localStorage
      try {
        localStorage.setItem('laserSignLogs', JSON.stringify(trimmedLogs));
      } catch (e) {
        console.warn('Failed to persist logs:', e);
      }

      return trimmedLogs;
    });

    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      const logMethod = status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'log';
      console[logMethod](`[${type}] ${action}:`, details, error || '');
    }
  }, [isLoggingEnabled, createLogEntry]);

  // Specialized logging functions
  const logUserAction = useCallback((action, details, status = 'success') => {
    log('user', action, details, status);
  }, [log]);

  const logGesture = useCallback((gestureType, details, success = true) => {
    log('user', `gesture_${gestureType}`, details, success ? 'success' : 'failure');
  }, [log]);

  const logCameraOperation = useCallback((operation, details, success = true, error = null) => {
    log('system', `camera_${operation}`, details, success ? 'success' : 'failure', error);
  }, [log]);

  const logProjectOperation = useCallback((operation, details, success = true, error = null) => {
    log('system', `project_${operation}`, details, success ? 'success' : 'failure', error);
  }, [log]);

  const logPerformance = useCallback((operation, duration, details = {}) => {
    log('performance', operation, { ...details, duration_ms: duration }, 'info');
  }, [log]);

  const logError = useCallback((error, context = '') => {
    log('error', 'application_error', { context, stack: error.stack }, 'error', error);
  }, [log]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.removeItem('laserSignLogs');
    log('system', 'logs_cleared', { cleared_at: new Date().toISOString() }, 'info');
  }, [log]);

  // Export logs
  const exportLogs = useCallback(() => {
    const exportData = {
      exported_at: new Date().toISOString(),
      app_version: '1.0.0',
      total_entries: logs.length,
      logs: logs
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `laser-sign-logs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
    log('system', 'logs_exported', { entry_count: logs.length }, 'success');
  }, [logs, log]);

  // Load logs from localStorage on mount
  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem('laserSignLogs');
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        setLogs(parsedLogs);
      }
    } catch (e) {
      console.warn('Failed to load saved logs:', e);
    }

    // Create session ID if not exists
    if (!sessionStorage.getItem('laserSignSessionId')) {
      sessionStorage.setItem('laserSignSessionId', Math.random().toString(36).slice(2));
    }

    // Log app startup
    log('system', 'app_startup', {
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      screen_size: `${window.screen.width}x${window.screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`
    }, 'info');
  }, [log]);

  // Filter and search functions
  const filterLogs = useCallback((filters = {}) => {
    return logs.filter(log => {
      if (filters.type && log.type !== filters.type) return false;
      if (filters.status && log.status !== filters.status) return false;
      if (filters.action && !log.action.includes(filters.action)) return false;
      if (filters.search && !JSON.stringify(log).toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [logs]);

  return {
    logs,
    isLoggingEnabled,
    setIsLoggingEnabled,

    // Main logging functions
    log,
    logUserAction,
    logGesture,
    logCameraOperation,
    logProjectOperation,
    logPerformance,
    logError,

    // Utility functions
    clearLogs,
    exportLogs,
    filterLogs,

    // Stats
    totalLogs: logs.length,
    errorCount: logs.filter(l => l.status === 'error').length,
    warningCount: logs.filter(l => l.status === 'warning').length
  };
}

/**
 * Professional Project Management System
 * Comprehensive project lifecycle management with cloud integration
 */
function useProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectTemplates, setProjectTemplates] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);

  // Project metadata structure
  const createProjectMetadata = useCallback((name, layers, calibration, camera) => {
    return {
      id: Math.random().toString(36).slice(2),
      name: name || "Untitled Project",
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      version: "1.0.0",
      description: "",
      tags: [],

      // Technical data
      calibration: {
        points: calibration.calibPoints || [],
        distanceMM: calibration.calibDistanceMM || "",
        pxPerMM: calibration.pxPerMM || null,
        accuracy: calibration.pxPerMM ? "High" : "Not Calibrated"
      },

      // Camera settings
      camera: {
        hasBackground: !!camera.bgImage,
        backgroundType: camera.useCamera ? "live" : "static",
        photoQuality: camera.photoQuality || 90,
        facingMode: camera.facingMode || "environment"
      },

      // Layer data (without blob URLs for serialization)
      layers: layers.map(layer => ({
        ...layer,
        url: undefined, // Remove blob URL
        createdAt: layer.createdAt || new Date().toISOString()
      })),

      // Statistics
      stats: {
        layerCount: layers.length,
        totalElements: layers.length,
        estimatedInstallTime: Math.ceil(layers.length * 5), // 5 minutes per element
        complexity: layers.length > 5 ? "High" : layers.length > 2 ? "Medium" : "Low"
      }
    };
  }, []);

  // Save project to local storage and cloud
  const saveProject = useCallback(async (name, layers, calibration, camera, description = "") => {
    setIsLoading(true);
    try {
      const projectData = createProjectMetadata(name, layers, calibration, camera);
      projectData.description = description;

      // Save to local storage
      const savedProjects = JSON.parse(localStorage.getItem('laserSignProjects') || '[]');
      const existingIndex = savedProjects.findIndex(p => p.id === projectData.id);

      if (existingIndex >= 0) {
        savedProjects[existingIndex] = projectData;
      } else {
        savedProjects.unshift(projectData);
      }

      // Keep only last 50 projects
      const trimmedProjects = savedProjects.slice(0, 50);
      localStorage.setItem('laserSignProjects', JSON.stringify(trimmedProjects));

      // Update recent projects
      updateRecentProjects(projectData);

      setCurrentProject(projectData);
      setProjects(trimmedProjects);

      // Cloud sync if enabled
      if (cloudSync) {
        await syncToCloud(projectData);
      }

      return projectData;
    } catch (error) {
      console.error('Failed to save project:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createProjectMetadata, cloudSync]);

  // Load project from storage
  const loadProject = useCallback(async (projectId) => {
    setIsLoading(true);
    try {
      const savedProjects = JSON.parse(localStorage.getItem('laserSignProjects') || '[]');
      const project = savedProjects.find(p => p.id === projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Rebuild blob URLs for layers
      const rebuiltLayers = await Promise.all(
        project.layers.map(async (layer) => {
          if (layer.svgText) {
            const blob = new Blob([layer.svgText], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            return { ...layer, url };
          }
          return layer;
        })
      );

      const loadedProject = { ...project, layers: rebuiltLayers };
      setCurrentProject(loadedProject);
      updateRecentProjects(loadedProject);

      return loadedProject;
    } catch (error) {
      console.error('Failed to load project:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update recent projects list
  const updateRecentProjects = useCallback((project) => {
    setRecentProjects(prev => {
      const filtered = prev.filter(p => p.id !== project.id);
      return [project, ...filtered].slice(0, 10); // Keep last 10
    });
  }, []);

  // Delete project functionality with cascading delete
  const deleteProject = useCallback(async (projectId) => {
    try {
      setIsLoading(true);

      // Find the project to delete
      const projectToDelete = projects.find(p => p.id === projectId);
      if (!projectToDelete) {
        throw new Error('Project not found');
      }

      // Remove from projects array
      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);

      // Remove from recent projects
      const updatedRecent = recentProjects.filter(p => p.id !== projectId);
      setRecentProjects(updatedRecent);

      // Update localStorage
      localStorage.setItem('laserSignProjects', JSON.stringify(updatedProjects));
      localStorage.setItem('laserSignRecentProjects', JSON.stringify(updatedRecent));

      // Clear current project if it's the one being deleted
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }

      // Cascading delete: Clean up related data
      // Remove any cached SVG blobs for this project
      const projectSVGKeys = Object.keys(localStorage).filter(key =>
        key.startsWith(`laserSign_project_${projectId}_svg_`)
      );
      projectSVGKeys.forEach(key => localStorage.removeItem(key));

      // Remove project-specific calibration data
      localStorage.removeItem(`laserSign_project_${projectId}_calibration`);

      // Remove project export history
      localStorage.removeItem(`laserSign_project_${projectId}_exports`);

      // Remove project settings/preferences
      localStorage.removeItem(`laserSign_project_${projectId}_settings`);

      // In a real Android implementation with Room database, this would be:
      // @Query("DELETE FROM projects WHERE id = :projectId")
      // with foreign key constraints: ON DELETE CASCADE for related tables:
      // - project_layers, project_assets, project_placements, project_jobs

      return { success: true, deletedProject: projectToDelete };
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projects, recentProjects, currentProject]);

  // Cloud sync functionality
  const syncToCloud = useCallback(async (projectData) => {
    // Placeholder for cloud integration
    // This would integrate with services like Firebase, Supabase, or AWS
    console.log('Cloud sync placeholder:', projectData.name);
    return Promise.resolve();
  }, []);

  // Load projects on mount
  useEffect(() => {
    const savedProjects = JSON.parse(localStorage.getItem('laserSignProjects') || '[]');
    const savedRecent = JSON.parse(localStorage.getItem('laserSignRecentProjects') || '[]');
    setProjects(savedProjects);
    setRecentProjects(savedRecent);
  }, []);

  // Save recent projects to storage
  useEffect(() => {
    localStorage.setItem('laserSignRecentProjects', JSON.stringify(recentProjects));
  }, [recentProjects]);

  return {
    // Project state
    projects, setProjects,
    currentProject, setCurrentProject,
    recentProjects,
    projectTemplates,
    isLoading,
    cloudSync, setCloudSync,

    // Project actions
    saveProject,
    loadProject,
    deleteProject,
    createProjectMetadata,

    // Utility functions
    updateRecentProjects
  };
}

/**
 * Advanced Export System with Multiple Formats and Professional Documentation
 */
function useAdvancedExport() {
  const [exportFormats] = useState([
    { id: 'png', name: 'PNG Image', extension: '.png', description: 'High-quality raster image' },
    { id: 'pdf', name: 'PDF Document', extension: '.pdf', description: 'Professional documentation' },
    { id: 'svg', name: 'SVG Vector', extension: '.svg', description: 'Scalable vector graphics' },
    { id: 'zip', name: 'Project Bundle', extension: '.zip', description: 'Complete project package' }
  ]);

  const [exportPresets] = useState([
    { id: 'preview', name: 'Preview Quality', width: 1920, height: 1080, dpi: 72 },
    { id: 'print', name: 'Print Quality', width: 3840, height: 2160, dpi: 300 },
    { id: 'professional', name: 'Professional', width: 7680, height: 4320, dpi: 600 }
  ]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Enhanced PNG export with quality options
  const exportPNG = useCallback(async (canvas, preset, projectData) => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');

      exportCanvas.width = preset.width;
      exportCanvas.height = preset.height;

      setExportProgress(25);

      // Scale and draw the original canvas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

      setExportProgress(75);

      const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
      const fileName = `${projectData.name}_${preset.id}_${new Date().toISOString().slice(0, 10)}.png`;

      setExportProgress(100);

      return { dataUrl, fileName, format: 'png' };
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, []);

  // PDF export with professional documentation
  const exportPDF = useCallback(async (canvas, projectData, calibration) => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // This would use a library like jsPDF for PDF generation
      // For now, we'll create a comprehensive data structure
      const pdfData = {
        title: `${projectData.name} - Installation Guide`,
        sections: [
          {
            title: 'Project Overview',
            content: {
              name: projectData.name,
              created: new Date(projectData.createdAt).toLocaleDateString(),
              description: projectData.description,
              complexity: projectData.stats.complexity,
              estimatedTime: `${projectData.stats.estimatedInstallTime} minutes`
            }
          },
          {
            title: 'Calibration Data',
            content: {
              accuracy: calibration.accuracy,
              pixelsPerMM: calibration.pxPerMM?.toFixed(4) || 'Not calibrated',
              referenceDistance: `${calibration.distanceMM}mm`,
              calibrationPoints: calibration.points.length
            }
          },
          {
            title: 'Layer Specifications',
            content: projectData.layers.map(layer => ({
              name: layer.name,
              position: `X: ${Math.round(layer.x)}px, Y: ${Math.round(layer.y)}px`,
              rotation: `${Math.round(layer.rot)}°`,
              scale: `${Math.round(layer.scale * 100)}%`,
              dimensions: `${Math.round(layer.originalWidth * layer.scale)}×${Math.round(layer.originalHeight * layer.scale)}mm`
            }))
          }
        ]
      };

      setExportProgress(100);

      const fileName = `${projectData.name}_documentation_${new Date().toISOString().slice(0, 10)}.pdf`;
      return { pdfData, fileName, format: 'pdf' };
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, []);

  return {
    // Export state
    exportFormats,
    exportPresets,
    isExporting,
    exportProgress,

    // Export functions
    exportPNG,
    exportPDF
  };
}

/**
 * Advanced Visual Feedback Components for Professional Touch Experience
 */

// PERFORMANCE OPTIMIZATION: Memoized SVG Layer Component
const MemoizedSVGLayer = React.memo(({
  layer,
  isActive,
  layerSizePX,
  touchGestures,
  setActiveId,
  pxPerMM
}) => {
  const { wpx, hpx } = layerSizePX(layer);

  return (
    <div
      key={layer.id}
      className={`group absolute select-none transition-all duration-200 ${isActive ? 'z-20' : 'z-10'}`}
      style={{
        left: layer.x,
        top: layer.y,
        width: wpx,
        height: hpx,
        transform: `rotate(${layer.rot}deg)`,
        opacity: layer.opacity
      }}
    >
      {/* Selection Border for Active Layer */}
      {isActive && (
        <div className="absolute -inset-3 rounded-lg border-2 border-emerald-400/70 bg-emerald-400/10 animate-pulse shadow-lg"></div>
      )}

      {/* Real-time Dimension Display */}
      <RealTimeDimensionDisplay
        layer={layer}
        isActive={isActive}
        pxPerMM={pxPerMM}
        gestureType={touchGestures.touchState.gestureType}
        gestureVelocity={touchGestures.gestureVelocity}
      />

      {/* Main SVG Image */}
      <div
        onMouseDown={(e) => touchGestures.beginDrag(layer.id, e)}
        onTouchStart={(e) => touchGestures.beginDrag(layer.id, e)}
        className={`absolute inset-0 rounded-lg overflow-hidden ${
          layer.lock ? "cursor-not-allowed" : "cursor-move"
        } ${isActive ? 'ring-2 ring-emerald-400/50' : ''}`}
      >
        <img
          src={layer.url}
          alt={layer.name}
          className="h-full w-full object-contain drop-shadow-lg"
          draggable={false}
          onClick={() => setActiveId(layer.id)}
        />
      </div>

      {/* Selection Indicator - Use Control Panel for manipulation */}
      {isActive && (
        <div className="absolute inset-0 border-2 border-emerald-400/70 rounded-lg pointer-events-none">
          <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-xs px-2 py-1 rounded">
            Selected - Use Control Panel
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal re-rendering
  const layer = nextProps.layer;
  const prevLayer = prevProps.layer;

  // Only re-render if essential properties have changed
  return (
    prevLayer.id === layer.id &&
    prevLayer.x === layer.x &&
    prevLayer.y === layer.y &&
    prevLayer.rot === layer.rot &&
    prevLayer.scale === layer.scale &&
    prevLayer.opacity === layer.opacity &&
    prevLayer.lock === layer.lock &&
    prevLayer.url === layer.url &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.pxPerMM === nextProps.pxPerMM &&
    prevProps.touchGestures.touchState.gestureType === nextProps.touchGestures.touchState.gestureType
  );
});

// Real-time Dimension Display Component
function RealTimeDimensionDisplay({ layer, isActive, pxPerMM, gestureType, gestureVelocity }) {
  if (!layer || !isActive) return null;

  const getDimensions = () => {
    if (!pxPerMM) return { original: "Unknown", current: "Unknown", scale: "100%" };

    const originalWidth = Math.round(layer.originalWidth || 100);
    const originalHeight = Math.round(layer.originalHeight || 100);
    const currentWidth = Math.round(originalWidth * layer.scale);
    const currentHeight = Math.round(originalHeight * layer.scale);
    const scalePercent = Math.round(layer.scale * 100);

    return {
      original: `${originalWidth}×${originalHeight}mm`,
      current: `${currentWidth}×${currentHeight}mm`,
      scale: `${scalePercent}%`,
      rotation: `${Math.round(layer.rot)}°`
    };
  };

  const dimensions = getDimensions();
  const isGesturing = gestureType !== null;

  return (
    <div className={`absolute -top-20 left-1/2 transform -translate-x-1/2 transition-all duration-200 ${
      isGesturing ? 'opacity-100 scale-100' : 'opacity-80 scale-95'
    }`}>
      <div className="bg-black/90 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20 shadow-2xl">
        <div className="text-center space-y-1">
          <div className="text-xs text-emerald-400 font-semibold">
            {dimensions.original}
          </div>
          <div className="text-sm text-white font-bold">
            {dimensions.current}
          </div>
          <div className="flex items-center justify-center gap-3 text-xs">
            <span className="text-yellow-400 font-semibold">{dimensions.scale}</span>
            <span className="text-blue-400">{dimensions.rotation}</span>
          </div>
          {isGesturing && (
            <div className="text-xs text-gray-400 capitalize">
              {gestureType}ing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Gesture Indicator Component
function GestureIndicator({ gestureType, gestureVelocity, position }) {
  if (!gestureType) return null;

  const getGestureIcon = () => {
    switch (gestureType) {
      case 'drag': return '✋';
      case 'rotate': return '↻';
      case 'resize': return '⤢';
      case 'multi': return '👆👆';
      default: return '✋';
    }
  };

  const getGestureColor = () => {
    switch (gestureType) {
      case 'drag': return 'text-blue-400';
      case 'rotate': return 'text-purple-400';
      case 'resize': return 'text-green-400';
      case 'multi': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="bg-black/80 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center border border-white/30 shadow-xl">
        <span className={`text-2xl ${getGestureColor()}`}>
          {getGestureIcon()}
        </span>
      </div>
      {Math.abs(gestureVelocity.x) > 0.1 || Math.abs(gestureVelocity.y) > 0.1 && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/70 rounded px-2 py-1 text-xs text-white">
            v: {Math.round(Math.hypot(gestureVelocity.x, gestureVelocity.y) * 100) / 100}
          </div>
        </div>
      )}
    </div>
  );
}

// Grid Overlay Component
function GridOverlay({ show, gridSize, stageRef }) {
  if (!show || !stageRef.current) return null;

  const rect = stageRef.current.getBoundingClientRect();
  const gridLines = [];

  // Vertical lines
  for (let x = 0; x <= rect.width; x += gridSize) {
    gridLines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={rect.height}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= rect.height; y += gridSize) {
    gridLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={rect.width}
        y2={y}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
    );
  }

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full">
      {gridLines}
    </svg>
  );
}

/**
 * SVG Control Panel - Redesigned 11-button control system for standardized SVG manipulation
 * Provides precise, incremental control over SVG positioning, rotation, and sizing
 */
function SVGControlPanel({
  activeLayer,
  onRotate,
  onSizeChange,
  onMove,
  onDelete,
  onAddSVG,
  isMobile,
  logger
}) {
  if (!activeLayer) return null;

  // Professional button component optimized for mobile
  const ControlButton = ({ onClick, className = '', title, children, label, variant = 'default' }) => {
    const baseClasses = `
      appearance-none border-none cursor-pointer text-gray-200 font-semibold
      rounded-lg transition-all duration-200 ease-out
      flex items-center justify-center
      shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,_0_4px_10px_rgba(0,0,0,0.45)]
      hover:shadow-[0_0_0_1px_rgba(34,197,94,0.5)_inset,_0_6px_14px_rgba(0,0,0,0.55)]
      active:translate-y-[1px] active:scale-[0.98]
      ${isMobile ? 'min-w-[44px] min-h-[44px] text-sm' : 'min-w-[48px] min-h-[48px] text-base'}
      ${className}
    `;

    const variantClasses = {
      default: 'bg-gradient-to-b from-[#18202e] to-[#121a27] hover:from-[#1b2636] hover:to-[#0f1724]',
      accent: 'bg-gradient-to-b from-[#18202e] to-[#121a27] hover:from-[#1b2636] hover:to-[#0f1724] shadow-[0_0_0_1px_rgba(34,197,94,0.5)_inset,_0_4px_10px_rgba(34,197,94,0.15)]',
      danger: 'bg-gradient-to-b from-[#2a0e10] to-[#1a0b0c] text-red-200 hover:from-[#3a1e20] hover:to-[#2a1b1c]'
    };

    return (
      <button
        onClick={onClick}
        onTouchStart={(e) => e.stopPropagation()}
        className={`${baseClasses} ${variantClasses[variant]}`}
        title={title}
        aria-label={label}
        style={{ touchAction: 'manipulation' }}
      >
        {children}
      </button>
    );
  };

  return (
    <div className={`fixed z-[60] ${isMobile ? 'bottom-24 left-2 right-2' : 'bottom-28 right-4'}`}>
      <div
        className={`bg-[#111927] border border-white/6 rounded-2xl shadow-[0_6px_14px_rgba(0,0,0,0.35),_0_0_0_1px_rgba(255,255,255,0.04)_inset] select-none ${isMobile ? 'p-2 w-full' : 'p-3 w-[400px]'}`}
        role="region"
        aria-label="SVG Controls"
      >
        {/* 3-column grid layout optimized for mobile */}
        <div className={`grid gap-1.5 items-stretch overflow-hidden ${isMobile ? 'grid-cols-[80px_1fr_80px] h-[180px]' : 'grid-cols-[1fr_2fr_1fr] h-[250px]'}`}>

          {/* Left Stack: Rotate Left, Size+, Delete */}
          <div className={`grid h-full auto-rows-fr ${isMobile ? 'gap-1' : 'gap-2'}`}>
            <ControlButton
              onClick={() => onRotate(-30)}
              variant="accent"
              title="Rotate Left 30°"
              label="Rotate SVG left 30 degrees"
              className={`h-full w-full ${isMobile ? 'text-xs px-1' : 'text-lg'}`}
            >
              {isMobile ? '↺' : '◀⟳'}
            </ControlButton>
            <ControlButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Size increase button clicked');
                onSizeChange(10);
              }}
              variant="accent"
              title="Increase Size +10mm"
              label="Increase SVG size by 10 millimeters"
              className={`h-full w-full ${isMobile ? 'text-sm px-1' : 'text-lg'} relative z-10`}
            >
              ＋
            </ControlButton>
            <ControlButton
              onClick={onDelete}
              variant="danger"
              title="Delete SVG"
              label="Delete current SVG"
              className={`h-full w-full ${isMobile ? 'text-xs px-1' : 'text-lg'}`}
            >
              {isMobile ? '🗑' : '␡'}
            </ControlButton>
          </div>

          {/* Center: Movement Cluster + Dimensions Readout */}
          <div className={`grid h-full ${isMobile ? 'grid-rows-[2.5fr_1fr] gap-2' : 'grid-rows-[2fr_1fr] gap-1.5'}`}>
            {/* Movement Cluster */}
            <div className={`grid grid-cols-2 grid-rows-3 h-full items-stretch justify-items-stretch ${isMobile ? 'gap-1' : 'gap-y-1'}`}
                 style={{
                   gridTemplateAreas: '"up up" "left right" "down down"'
                 }}>
              <ControlButton
                onClick={() => onMove('up')}
                title="Move Up 20px"
                label="Move SVG up by 20 pixels"
                className={`w-full h-full ${isMobile ? 'text-sm p-0.5' : 'text-base p-1'}`}
                style={{ gridArea: 'up' }}
              >
                ▲
              </ControlButton>
              <ControlButton
                onClick={() => onMove('left')}
                title="Move Left 20px"
                label="Move SVG left by 20 pixels"
                className={`w-full h-full ${isMobile ? 'text-sm p-0.5' : 'text-base p-1'}`}
                style={{ gridArea: 'left' }}
              >
                ◀
              </ControlButton>
              <ControlButton
                onClick={() => onMove('right')}
                title="Move Right 20px"
                label="Move SVG right by 20 pixels"
                className={`w-full h-full ${isMobile ? 'text-sm p-0.5' : 'text-base p-1'}`}
                style={{ gridArea: 'right' }}
              >
                ▶
              </ControlButton>
              <ControlButton
                onClick={() => onMove('down')}
                title="Move Down 20px"
                label="Move SVG down by 20 pixels"
                className={`w-full h-full ${isMobile ? 'text-sm p-0.5' : 'text-base p-1'}`}
                style={{ gridArea: 'down' }}
              >
                ▼
              </ControlButton>
            </div>

            {/* Dimensions Readout */}
            <div className="flex items-center h-full min-h-0">
              <div className={`w-full rounded-lg bg-[#0e1522] border border-white/7 shadow-[0_0_0_1px_rgba(34,197,94,0.25)_inset,_0_6px_16px_rgba(0,0,0,0.4)] text-gray-200 font-mono flex items-center justify-center ${isMobile ? 'p-2 text-[11px] min-h-[32px]' : 'p-2 text-xs min-h-[40px]'}`}>
                <div className="w-full text-center leading-tight">
                  {isMobile ? (
                    <div className="truncate">
                      Current: {activeLayer ? `${Math.round(activeLayer.originalWidth * activeLayer.scale)}×${Math.round(activeLayer.originalHeight * activeLayer.scale)}mm (${Math.round(activeLayer.scale * 100)}%)` : '—×—mm (—%)'}
                    </div>
                  ) : (
                    <div className="truncate">
                      Original: {activeLayer ? `${activeLayer.originalWidth}×${activeLayer.originalHeight}mm` : '—'} |
                      Current: {activeLayer ? `${Math.round(activeLayer.originalWidth * activeLayer.scale)}×${Math.round(activeLayer.originalHeight * activeLayer.scale)}mm` : '—'} |
                      Scale: {activeLayer ? `${Math.round(activeLayer.scale * 100)}%` : '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Stack: Rotate Right, Size-, Add SVG */}
          <div className={`grid h-full auto-rows-fr ${isMobile ? 'gap-1' : 'gap-2'}`}>
            <ControlButton
              onClick={() => onRotate(30)}
              variant="accent"
              title="Rotate Right 30°"
              label="Rotate SVG right 30 degrees"
              className={`h-full w-full ${isMobile ? 'text-xs px-1' : 'text-lg'}`}
            >
              {isMobile ? '↻' : '⟳▶'}
            </ControlButton>
            <ControlButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Size decrease button clicked');
                onSizeChange(-10);
              }}
              variant="accent"
              title="Decrease Size -10mm"
              label="Decrease SVG size by 10 millimeters"
              className={`h-full w-full ${isMobile ? 'text-sm px-1' : 'text-lg'} relative z-10`}
            >
              −
            </ControlButton>
            <ControlButton
              onClick={onAddSVG}
              variant="default"
              title="Add New SVG"
              label="Add new SVG to canvas"
              className={`h-full w-full ${isMobile ? 'text-[10px] px-0.5' : 'text-lg'}`}
            >
              {isMobile ? '+' : '＋SVG'}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Application Logs Viewer Component
 * Professional logging interface for debugging and analysis
 */
function LogsViewer({ isOpen, onClose, logger }) {
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    action: '',
    search: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = logger.filterLogs(filters);

  const getStatusColor = (status) => {
    switch (status) {
      case 'error': return 'text-red-400 bg-red-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20';
      case 'success': return 'text-green-400 bg-green-500/20';
      case 'info': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'user': return '👤';
      case 'system': return '⚙️';
      case 'error': return '❌';
      case 'performance': return '⚡';
      default: return '📝';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-700">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <h2 className="text-lg sm:text-2xl font-bold text-white">Application Logs</h2>
            <div className="hidden sm:flex space-x-4 text-sm">
              <span className="text-gray-400">Total: {logger.totalLogs}</span>
              <span className="text-red-400">Errors: {logger.errorCount}</span>
              <span className="text-yellow-400">Warnings: {logger.warningCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={logger.exportLogs}
              className="px-2 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Export
            </button>
            <button
              onClick={logger.clearLogs}
              className="px-2 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <span className="text-2xl text-gray-400">×</span>
            </button>
          </div>
        </div>

        {/* Mobile Stats */}
        <div className="sm:hidden p-3 border-b border-gray-700 bg-gray-800/50">
          <div className="flex justify-around text-xs">
            <span className="text-gray-400">Total: {logger.totalLogs}</span>
            <span className="text-red-400">Errors: {logger.errorCount}</span>
            <span className="text-yellow-400">Warnings: {logger.warningCount}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"
            >
              <option value="">All Types</option>
              <option value="user">User Actions</option>
              <option value="system">System Events</option>
              <option value="error">Errors</option>
              <option value="performance">Performance</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <input
              type="text"
              placeholder="Filter by action..."
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm min-h-[44px]"
            />
            <input
              type="text"
              placeholder="Search logs..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm min-h-[44px]"
            />
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          <div className="w-full sm:w-1/2 sm:border-r border-gray-700 overflow-y-auto custom-scrollbar">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`p-3 sm:p-4 border-b border-gray-700/50 cursor-pointer hover:bg-gray-800/50 transition-colors min-h-[60px] ${
                  selectedLog?.id === log.id ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(log.type)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-white font-medium mb-1 text-sm sm:text-base">{log.action}</div>
                <div className="text-gray-400 text-xs sm:text-sm truncate">
                  {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                No logs match the current filters
              </div>
            )}
          </div>

          {/* Log Details */}
          <div className="w-full sm:w-1/2 overflow-y-auto custom-scrollbar">
            {selectedLog ? (
              <div className="p-3 sm:p-6">
                <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <span className="text-2xl">{getTypeIcon(selectedLog.type)}</span>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white">{selectedLog.action}</h3>
                      <p className="text-gray-400 text-sm">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedLog.status)}`}>
                    {selectedLog.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Details</h4>
                    <pre className="bg-gray-800 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>

                  {selectedLog.error && (
                    <div>
                      <h4 className="text-base sm:text-lg font-semibold text-red-400 mb-2">Error</h4>
                      <pre className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-red-300 overflow-x-auto">
                        {selectedLog.error}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Type:</span>
                      <span className="ml-2 text-white">{selectedLog.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Session:</span>
                      <span className="ml-2 text-white font-mono text-xs">{selectedLog.sessionId}</span>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-gray-400">ID:</span>
                      <span className="ml-2 text-white font-mono text-xs">{selectedLog.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                Select a log entry to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Professional Measurement Tools Component
function MeasurementTools({ layers, pxPerMM, showMeasurements }) {
  if (!showMeasurements || !pxPerMM || layers.length < 2) return null;

  const measurements = [];

  // Calculate distances between layers
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      const layer1 = layers[i];
      const layer2 = layers[j];

      const distance = Math.hypot(
        layer2.x - layer1.x,
        layer2.y - layer1.y
      );

      const distanceMM = Math.round(distance / pxPerMM);

      if (distanceMM > 10) { // Only show significant distances
        const midX = (layer1.x + layer2.x) / 2;
        const midY = (layer1.y + layer2.y) / 2;

        measurements.push(
          <div
            key={`${layer1.id}-${layer2.id}`}
            className="absolute pointer-events-none"
            style={{ left: midX, top: midY, transform: 'translate(-50%, -50%)' }}
          >
            <div className="bg-black/70 backdrop-blur-sm rounded px-2 py-1 text-xs text-white border border-white/20">
              {distanceMM}mm
            </div>
          </div>
        );
      }
    }
  }

  return <>{measurements}</>;
}

/**
 * Project Management Panel - Professional project lifecycle management
 */
function ProjectManagementPanel({ isOpen, onClose, projectManager, onLoadProject, onDeleteProject, isMobile = false }) {
  const [activeTab, setActiveTab] = useState('recent');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredProjects = projectManager.projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      // This would trigger project creation in the main app
      onClose();
      setNewProjectName('');
      setNewProjectDescription('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-2 sm:p-4">
      <div className={`bg-gray-900 rounded-2xl w-full ${isMobile ? 'h-[95vh]' : 'max-w-4xl max-h-[90vh]'} overflow-hidden border border-gray-700 shadow-2xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${isMobile ? 'p-4' : 'p-6'} border-b border-gray-700`}>
          <h2 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-white`}>Project Management</h2>
          <button
            onClick={onClose}
            className={`${isMobile ? 'w-12 h-12 min-w-[48px] min-h-[48px]' : 'w-10 h-10'} rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors`}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation - Mobile Responsive */}
        <div className={`flex border-b border-gray-700 ${isMobile ? 'overflow-x-auto' : ''}`}>
          {[
            { id: 'recent', label: isMobile ? 'Recent' : 'Recent Projects', icon: '🕒' },
            { id: 'all', label: isMobile ? 'All' : 'All Projects', icon: '📁' },
            { id: 'templates', label: isMobile ? 'Templates' : 'Templates', icon: '📋' },
            { id: 'new', label: isMobile ? 'New' : 'New Project', icon: '➕' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 ${isMobile ? 'px-3 py-3 min-w-[80px]' : 'px-6 py-4'} font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Recent Projects Tab */}
          {activeTab === 'recent' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Projects</h3>
              {projectManager.recentProjects.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-6xl mb-4">📂</div>
                  <p>No recent projects found</p>
                  <p className="text-sm">Create your first project to get started</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {projectManager.recentProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onLoad={() => onLoadProject(project.id)}
                      onDelete={onDeleteProject}
                      isRecent={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Projects Tab */}
          {activeTab === 'all' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-lg font-semibold text-white">All Projects</h3>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-6xl mb-4">🔍</div>
                  <p>No projects found</p>
                  {searchQuery && <p className="text-sm">Try adjusting your search terms</p>}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onLoad={() => onLoadProject(project.id)}
                      onDelete={onDeleteProject}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Project Tab */}
          {activeTab === 'new' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Create New Project</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Describe your project..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  Create Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Project Card Component
function ProjectCard({ project, onLoad, onDelete, isRecent = false }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getComplexityColor = (complexity) => {
    switch (complexity) {
      case 'High': return 'text-red-400 bg-red-400/20';
      case 'Medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'Low': return 'text-green-400 bg-green-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-white mb-1">{project.name}</h4>
          {project.description && (
            <p className="text-gray-400 text-sm mb-2">{project.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Created: {formatDate(project.createdAt)}</span>
            <span>Modified: {formatDate(project.modifiedAt)}</span>
          </div>
        </div>

        {isRecent && (
          <div className="bg-emerald-400/20 text-emerald-400 px-2 py-1 rounded text-xs font-medium">
            Recent
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Layers:</span>
            <span className="text-white font-medium">{project.stats.layerCount}</span>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium ${getComplexityColor(project.stats.complexity)}`}>
            {project.stats.complexity}
          </div>
          <div className="text-gray-400 text-xs">
            ~{project.stats.estimatedInstallTime}min
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-600/30"
            title="Delete Project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onLoad}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Load Project
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-red-500/50 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Project</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-white mb-2">Are you sure you want to delete:</p>
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <p className="font-semibold text-white">{project.name}</p>
                {project.description && (
                  <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                  <span>{project.stats.layerCount} layers</span>
                  <span>Created: {formatDate(project.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(project.id);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Advanced Export Panel - Professional export system with multiple formats
 */
function AdvancedExportPanel({ isOpen, onClose, exportSystem, onExport }) {
  const [selectedFormat, setSelectedFormat] = useState('png');
  const [selectedPreset, setSelectedPreset] = useState('preview');
  const [includeDocumentation, setIncludeDocumentation] = useState(true);
  const [exportOptions, setExportOptions] = useState({
    includeCalibration: true,
    includeMeasurements: true,
    includeLayerSpecs: true,
    generateReport: true
  });

  if (!isOpen) return null;

  const selectedFormatData = exportSystem.exportFormats.find(f => f.id === selectedFormat);
  const selectedPresetData = exportSystem.exportPresets.find(p => p.id === selectedPreset);

  const handleExport = () => {
    onExport({
      format: selectedFormat,
      preset: selectedPreset,
      options: exportOptions,
      includeDocumentation
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">Export Project</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content - Optimized spacing for Samsung S20+ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Format Selection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Export Format</h3>
            <div className="grid grid-cols-2 gap-3">
              {exportSystem.exportFormats.map(format => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedFormat === format.id
                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">{format.name}</div>
                  <div className="text-xs opacity-75 mt-1">{format.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality Preset */}
          {selectedFormat === 'png' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Quality Preset</h3>
              <div className="space-y-2">
                {exportSystem.exportPresets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedPreset === preset.id
                        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{preset.name}</span>
                      <span className="text-xs opacity-75">
                        {preset.width}×{preset.height} @ {preset.dpi}DPI
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export Options */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeDocumentation}
                  onChange={(e) => setIncludeDocumentation(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-600 rounded focus:ring-emerald-500"
                />
                <span className="text-gray-300">Include professional documentation</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeCalibration}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeCalibration: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-600 rounded focus:ring-emerald-500"
                />
                <span className="text-gray-300">Include calibration data</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMeasurements}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeMeasurements: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-600 rounded focus:ring-emerald-500"
                />
                <span className="text-gray-300">Include measurement specifications</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.generateReport}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, generateReport: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-600 rounded focus:ring-emerald-500"
                />
                <span className="text-gray-300">Generate installation report</span>
              </label>
            </div>
          </div>

          {/* Export Preview - Compact for mobile */}
          {selectedFormatData && selectedPresetData && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <h4 className="font-medium text-white mb-2 text-sm">Export Preview</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Format: {selectedFormatData.name}</div>
                {selectedFormat === 'png' && (
                  <div>Resolution: {selectedPresetData.width}×{selectedPresetData.height} ({selectedPresetData.dpi} DPI)</div>
                )}
                <div>Documentation: {includeDocumentation ? 'Included' : 'Not included'}</div>
              </div>
            </div>
          )}

          {/* Export Progress - Compact for mobile */}
          {exportSystem.isExporting && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">Exporting...</span>
                <span className="text-emerald-400 text-sm">{exportSystem.exportProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportSystem.exportProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer - Always visible on Samsung S20+ */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 flex-shrink-0 bg-gray-900">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exportSystem.isExporting}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {exportSystem.isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AR Overlay Stage - Interactive layer for SVG manipulation and calibration
 */
function AROverlayStage({
  children,
  stageRef,
  onStageClick,
  touchGestures,
  onWheel,
  activeLayerId,
  pxPerMM,
  isMobile = false
}) {
  const {
    touchState, setTouchState,
    onDrag, endDrag,
    doRotate, endRotate,
    doResize, endResize,
    calculateDistance, calculateRotation,
    handleMultiTouch,
    snapToGrid, gridSize,
    showMeasurements, gestureVelocity
  } = touchGestures;

  // Enhanced touch handlers with advanced gesture recognition
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    const touches = Array.from(e.touches);

    if (touches.length === 2 && activeLayerId) {
      // Two fingers - advanced multi-touch gesture
      handleMultiTouch(touches, activeLayerId);
    } else if (touches.length === 1) {
      // Single finger - prepare for potential drag
      setTouchState(prev => ({
        ...prev,
        gestureStartTime: Date.now(),
        isGesturing: false
      }));
    }
  }, [handleMultiTouch, activeLayerId, setTouchState]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const touches = Array.from(e.touches);

    if (touches.length === 1) {
      // Single finger drag only - multi-touch gestures disabled for control panel use
      onDrag(e);
    }
    // Multi-touch gestures (pinch, rotate) disabled - use control panel instead
  }, [onDrag]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    endDrag();
    endRotate();
    endResize();
    setTouchState(prev => ({
      ...prev,
      touches: [],
      initialDistance: null,
      initialScale: 1,
      initialRotation: 0,
      isGesturing: false,
      gestureType: null,
      gestureStartTime: null
    }));
  }, [endDrag, endRotate, endResize, setTouchState]);

  // Enhanced mouse handlers - drag only for control panel use
  const handleMouseMove = useCallback((e) => {
    // Check for precision mode (Shift key)
    if (e.shiftKey && !touchGestures.precisionMode) {
      touchGestures.togglePrecisionMode();
    } else if (!e.shiftKey && touchGestures.precisionMode) {
      touchGestures.togglePrecisionMode();
    }

    // Only allow drag - rotation and resize disabled for control panel use
    onDrag(e);
  }, [onDrag, touchGestures]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'g':
      case 'G':
        touchGestures.toggleSnapToGrid();
        break;
      case 'Shift':
        if (!touchGestures.precisionMode) {
          touchGestures.togglePrecisionMode();
        }
        break;
      case 'm':
      case 'M':
        touchGestures.toggleMeasurements();
        break;
    }
  }, [touchGestures]);

  const handleKeyUp = useCallback((e) => {
    if (e.key === 'Shift' && touchGestures.precisionMode) {
      touchGestures.togglePrecisionMode();
    }
  }, [touchGestures]);

  // Focus management for keyboard shortcuts
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.tabIndex = 0; // Make focusable
      stage.addEventListener('keydown', handleKeyDown);
      stage.addEventListener('keyup', handleKeyUp);

      return () => {
        stage.removeEventListener('keydown', handleKeyDown);
        stage.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [handleKeyDown, handleKeyUp, stageRef]);

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 focus:outline-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseUp={() => { endDrag(); }}
      onMouseLeave={() => { endDrag(); }}
      onWheel={onWheel}
      onClick={onStageClick}
    >
      {/* Grid Overlay */}
      <GridOverlay
        show={snapToGrid}
        gridSize={gridSize}
        stageRef={stageRef}
      />

      {/* Main Content */}
      {children}

      {/* Gesture Indicator */}
      <GestureIndicator
        gestureType={touchState.gestureType}
        gestureVelocity={gestureVelocity}
        position={touchState.gestureType ? { x: '50%', y: '50%' } : null}
      />

      {/* Professional Status Indicators - Mobile positioned to avoid navigation overlap */}
      {(snapToGrid || touchGestures.precisionMode || showMeasurements) && (
        <div className={`absolute space-y-2 ${isMobile ? 'top-16 right-2' : 'top-4 right-4'}`}>
          {snapToGrid && (
            <div className="bg-black/70 backdrop-blur-sm rounded px-3 py-1 text-xs text-emerald-400 border border-emerald-400/30">
              Grid: {gridSize}px
            </div>
          )}
          {touchGestures.precisionMode && (
            <div className="bg-black/70 backdrop-blur-sm rounded px-3 py-1 text-xs text-blue-400 border border-blue-400/30">
              Precision Mode
            </div>
          )}
          {showMeasurements && (
            <div className="bg-black/70 backdrop-blur-sm rounded px-3 py-1 text-xs text-purple-400 border border-purple-400/30">
              Measurements
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Help - Hidden on mobile devices */}
      {!isMobile && (
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded px-3 py-2 text-xs text-white/70 space-y-1">
          <div><kbd className="bg-white/20 px-1 rounded">G</kbd> Toggle Grid</div>
          <div><kbd className="bg-white/20 px-1 rounded">Shift</kbd> Precision Mode</div>
          <div><kbd className="bg-white/20 px-1 rounded">M</kbd> Toggle Measurements</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  console.log('🚀 LIVE RELOAD WORKING! App component rendering...', new Date().toLocaleTimeString());

  // Add error boundary and simple test
  const [hasError, setHasError] = useState(false);
  const [showSimpleTest, setShowSimpleTest] = useState(false);

  useEffect(() => {
    const handleError = (error) => {
      console.error('App Error:', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);

    // Show simple test after 3 seconds if main app doesn't load
    const timer = setTimeout(() => {
      console.log('Showing simple test fallback');
      setShowSimpleTest(true);
    }, 3000);

    return () => {
      window.removeEventListener('error', handleError);
      clearTimeout(timer);
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen w-full bg-red-900 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Application Error</h1>
          <p className="mb-4">Something went wrong. Please refresh the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Simple test mode
  if (showSimpleTest) {
    return (
      <div className="min-h-screen w-full bg-blue-900 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-3xl font-bold mb-4">🎯 Laser Sign Visualizer</h1>
          <p className="text-lg mb-6">Samsung Galaxy S20+ Test Mode</p>
          <div className="space-y-4">
            <button
              onClick={() => setShowSimpleTest(false)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg"
            >
              Load Full App
            </button>
            <div className="text-sm text-blue-200">
              If you see this, React is working correctly.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black text-white overflow-hidden">
      {/* Full-screen AR application - no traditional layout constraints */}
      <main className="relative h-screen w-full">
        <SignSizerApp />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg">
            <span className="text-lg font-bold text-white">📐</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-400">
              Laser Sign Visualizer
            </h1>
            <p className="text-xs text-slate-400 font-medium">Professional Sign Placement Tool</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>mm‑accurate • APK‑ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="text-emerald-400">💡</span>
            <span>
              <strong className="text-slate-300">Tip:</strong> In Simple mode, you have a single sign layer.
              Open <em className="text-emerald-400">More Options</em> for multi‑layer and project tools.
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Built for professional sign installation
          </div>
        </div>
      </div>
    </footer>
  );
}

// Types
/** @typedef {{x:number,y:number}} Point */
/** @typedef {{id:string,name:string,svgText:string,url:string,x:number,y:number,rot:number,heightMM:number,scale:number,opacity:number,lock:boolean}} Layer */

/**
 * General Settings Section - Units, export format, theme, gestures
 */
function GeneralSettingsSection({ settings, setSettings }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>

      {/* Units */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Units</label>
        <select
          value={settings.units}
          onChange={(e) => setSettings(prev => ({ ...prev, units: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="mm">Millimeters (mm)</option>
          <option value="cm">Centimeters (cm)</option>
          <option value="in">Inches (in)</option>
        </select>
      </div>

      {/* Export Format */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Default Export Format</label>
        <select
          value={settings.exportFormat}
          onChange={(e) => setSettings(prev => ({ ...prev, exportFormat: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="png">PNG (Recommended)</option>
          <option value="jpg">JPEG</option>
          <option value="pdf">PDF Documentation</option>
        </select>
      </div>

      {/* Export Resolution */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Export Resolution</label>
        <select
          value={settings.exportResolution}
          onChange={(e) => setSettings(prev => ({ ...prev, exportResolution: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="preview">Preview (1920x1080)</option>
          <option value="high">High Quality (3840x2160)</option>
          <option value="professional">Professional (7680x4320)</option>
        </select>
      </div>

      {/* Gesture Sensitivity */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Touch Gesture Sensitivity</label>
        <select
          value={settings.gestureSensitivity}
          onChange={(e) => setSettings(prev => ({ ...prev, gestureSensitivity: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="low">Low (Precise)</option>
          <option value="medium">Medium (Balanced)</option>
          <option value="high">High (Responsive)</option>
        </select>
      </div>

      {/* Theme */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Theme</label>
        <select
          value={settings.theme}
          onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="dark">Dark (Recommended)</option>
          <option value="light">Light</option>
          <option value="auto">Auto (System)</option>
        </select>
      </div>
    </div>
  );
}

/**
 * Project Settings Section - Active project, location, backup
 */
function ProjectSettingsSection({ projectName, setProjectName, svgLayers, settings, setSettings }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Project Settings</h3>

      {/* Active Project */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Active Project Name</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          placeholder="Enter project name"
        />
        <div className="mt-2 text-xs text-slate-400">
          {svgLayers.layers.length} layer{svgLayers.layers.length !== 1 ? 's' : ''} • Read-only display
        </div>
      </div>

      {/* Default Project Location */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Default Project Location</label>
        <select
          value={settings.defaultLocation}
          onChange={(e) => setSettings(prev => ({ ...prev, defaultLocation: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="device">Device Storage (Scoped)</option>
          <option value="downloads">Downloads Folder</option>
          <option value="documents">Documents Folder</option>
        </select>
        <div className="mt-2 text-xs text-slate-400">
          Projects saved to scoped storage for security
        </div>
      </div>

      {/* Auto Backup */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.autoBackup}
            onChange={(e) => setSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
            className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
          />
          <div>
            <div className="text-sm font-medium text-white">Auto Backup Projects</div>
            <div className="text-xs text-slate-400">Automatically backup projects every 5 minutes</div>
          </div>
        </label>
      </div>

      {/* Backup/Restore Config */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Backup & Restore</h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-all">
            Export Configuration (.json)
          </button>
          <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all">
            Import Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Asset Settings Section - Custom SVG import, cache management
 */
function AssetSettingsSection({ settings, setSettings, onSVGUpload }) {
  const fileInputRef = useRef(null);

  const handleCustomSVGImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        // Use the existing SVG upload handler
        if (onSVGUpload) {
          onSVGUpload(file);
        }
        // Reset the input
        e.target.value = '';
      } else {
        alert('Please select a valid SVG file (.svg extension)');
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Asset Management</h3>

      {/* Custom SVG Import */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Import Custom SVGs</h4>
        <button
          onClick={handleCustomSVGImport}
          className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import SVG File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="mt-2 text-xs text-slate-400">
          Supports SVG files with MIME type 'image/svg+xml'
        </div>
      </div>

      {/* SVG Cache Management */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">SVG Cache</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Cache Size Limit</span>
            <select
              value={settings.svgCacheSize}
              onChange={(e) => setSettings(prev => ({ ...prev, svgCacheSize: e.target.value }))}
              className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            >
              <option value="25MB">25 MB</option>
              <option value="50MB">50 MB</option>
              <option value="100MB">100 MB</option>
            </select>
          </div>
          <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all">
            Clear SVG Cache
          </button>
        </div>
      </div>

      {/* Auto Cleanup */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.autoCleanup}
            onChange={(e) => setSettings(prev => ({ ...prev, autoCleanup: e.target.checked }))}
            className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
          />
          <div>
            <div className="text-sm font-medium text-white">Auto Cleanup</div>
            <div className="text-xs text-slate-400">Automatically remove unused assets weekly</div>
          </div>
        </label>
      </div>
    </div>
  );
}

/**
 * Camera Settings Section - Resolution, 60fps, low-latency capture
 */
function CameraSettingsSection({ camera, settings, setSettings }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Camera Settings</h3>

      {/* Preferred Resolution */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Preferred Resolution</label>
        <select
          value={settings.preferredResolution}
          onChange={(e) => setSettings(prev => ({ ...prev, preferredResolution: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="1280x720">HD (1280x720)</option>
          <option value="1920x1080">Full HD (1920x1080)</option>
          <option value="2560x1440">QHD (2560x1440)</option>
          <option value="3840x2160">4K UHD (3840x2160)</option>
        </select>
        <div className="mt-2 text-xs text-slate-400">
          Higher resolutions may impact performance
        </div>
      </div>

      {/* 60fps Toggle */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.enable60fps}
            onChange={(e) => setSettings(prev => ({ ...prev, enable60fps: e.target.checked }))}
            className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
          />
          <div>
            <div className="text-sm font-medium text-white">Enable 60fps (if supported)</div>
            <div className="text-xs text-slate-400">Smoother camera preview, may drain battery faster</div>
          </div>
        </label>
      </div>

      {/* Low-latency Capture */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.lowLatencyCapture}
            onChange={(e) => setSettings(prev => ({ ...prev, lowLatencyCapture: e.target.checked }))}
            className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
          />
          <div>
            <div className="text-sm font-medium text-white">Low-latency Capture</div>
            <div className="text-xs text-slate-400">Faster photo capture, optimized for Samsung S20+</div>
          </div>
        </label>
      </div>

      {/* Camera Capabilities */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Device Capabilities</h4>
        <div className="space-y-2 text-xs text-slate-400">
          <div>Available Cameras: {camera.availableCameras.length}</div>
          <div>Current Facing: {camera.facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}</div>
          <div>Flash Support: {camera.flashMode !== 'off' ? 'Yes' : 'No'}</div>
          <div>Permission: {camera.permissionState}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Calibration Settings Section - Wizard and scale computation
 */
function CalibrationSettingsSection({ calibration }) {
  const [calibrationMode, setCalibrationMode] = useState('distance');
  const [distanceToSubject, setDistanceToSubject] = useState('1.0');
  const [targetSize, setTargetSize] = useState('100');

  const handleDistanceCalibration = () => {
    const distance = parseFloat(distanceToSubject);
    const size = parseFloat(targetSize);
    if (distance > 0 && size > 0) {
      // Simplified calculation - in real implementation would use camera FOV
      const estimatedPxPerMM = (1920 / (distance * 1000)) * size;
      calibration.setCalibDistanceMM(size);
      // This is a placeholder - real implementation would be more complex
      console.log('Distance calibration:', { distance, size, estimatedPxPerMM });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Calibration Wizard</h3>

      {/* Current Status */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Current Calibration</h4>
        <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
          calibration.pxPerMM ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
        }`}>
          {calibration.pxPerMM ? '✓ Calibrated' : '⚠ Not Calibrated'}
        </div>
        {calibration.pxPerMM && (
          <div className="mt-2 text-xs text-slate-400">
            Scale: {calibration.pxPerMM.toFixed(2)} px/mm
          </div>
        )}
      </div>

      {/* Calibration Method */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <label className="block text-sm font-medium text-white mb-2">Calibration Method</label>
        <select
          value={calibrationMode}
          onChange={(e) => setCalibrationMode(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
        >
          <option value="distance">Distance to Subject</option>
          <option value="marker">Known-size Marker</option>
        </select>
      </div>

      {/* Distance Method */}
      {calibrationMode === 'distance' && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-medium text-white mb-3">Distance Calibration</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Distance to subject (meters)</label>
              <input
                type="number"
                value={distanceToSubject}
                onChange={(e) => setDistanceToSubject(e.target.value)}
                step="0.1"
                min="0.1"
                max="10"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target size (mm)</label>
              <input
                type="number"
                value={targetSize}
                onChange={(e) => setTargetSize(e.target.value)}
                step="1"
                min="1"
                max="1000"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
              />
            </div>
            <button
              onClick={handleDistanceCalibration}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-all"
            >
              Calculate Scale
            </button>
          </div>
        </div>
      )}

      {/* Reset Calibration */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <button
          onClick={calibration.resetCalibration}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
        >
          Reset Calibration
        </button>
      </div>
    </div>
  );
}

/**
 * Diagnostics Section - Logs, device info, session data
 */
function DiagnosticsSection({
  logger,
  viewportSize,
  screenOrientation,
  isMobile,
  setShowLogsViewer,
  setShowSettingsPanel
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Diagnostics & Debugging</h3>

      {/* Application Logs */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Application Logs</h4>
        <div className="space-y-3">
          <button
            onClick={() => {
              setShowLogsViewer(true);
              setShowSettingsPanel(false);
              logger.logUserAction('settings_open_logs', { action: 'open_logs_viewer' });
            }}
            className={`w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-all flex items-center justify-between ${isMobile ? 'min-h-[44px]' : ''}`}
          >
            <div className="flex items-center space-x-2">
              <span>📝</span>
              <span>View Application Logs</span>
            </div>
            <span className="text-xs bg-blue-500 px-2 py-1 rounded">
              {logger.totalLogs}
            </span>
          </button>

          {logger.errorCount > 0 && (
            <div className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded border border-red-500/30">
              ⚠️ {logger.errorCount} error{logger.errorCount !== 1 ? 's' : ''} logged
            </div>
          )}

          <div className="text-xs text-slate-400">
            Session: {sessionStorage.getItem('laserSignSessionId')?.slice(0, 8) || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Device Information */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Device Information</h4>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Screen Resolution:</span>
            <span>{viewportSize.width}×{viewportSize.height}</span>
          </div>
          <div className="flex justify-between">
            <span>Orientation:</span>
            <span>{screenOrientation}</span>
          </div>
          <div className="flex justify-between">
            <span>Device Type:</span>
            <span>{isMobile ? 'Mobile' : 'Desktop'}</span>
          </div>
          <div className="flex justify-between">
            <span>Touch Support:</span>
            <span>{('ontouchstart' in window) ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span>User Agent:</span>
            <span className="text-right max-w-[200px] truncate">{navigator.userAgent}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform:</span>
            <span>{navigator.platform}</span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Performance</h4>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Memory Usage:</span>
            <span>{(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(1) || 'N/A'} MB</span>
          </div>
          <div className="flex justify-between">
            <span>Connection:</span>
            <span>{navigator.connection?.effectiveType || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span>Hardware Concurrency:</span>
            <span>{navigator.hardwareConcurrency || 'Unknown'} cores</span>
          </div>
        </div>
      </div>

      {/* System Actions */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">System Actions</h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all">
            Export Diagnostic Report
          </button>
          <button className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-all">
            Clear All Cache
          </button>
          <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all">
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Comprehensive Settings Panel - Professional configuration system
 * Redesigned for Samsung Galaxy S20+ with complete feature set
 */
function ComprehensiveSettingsPanel({
  isOpen,
  onClose,
  isMobile,
  calibration,
  projectName,
  setProjectName,
  svgLayers,
  camera,
  logger,
  viewportSize,
  screenOrientation,
  setShowLogsViewer,
  setShowSettingsPanel,
  onSVGUpload
}) {
  const [activeSection, setActiveSection] = useState('general');
  const [settings, setSettings] = useState({
    // General settings
    units: 'mm',
    exportFormat: 'png',
    exportResolution: 'high',
    gestureSensitivity: 'medium',
    theme: 'dark',

    // Camera settings
    preferredResolution: '1920x1080',
    enable60fps: false,
    lowLatencyCapture: true,

    // Project settings
    defaultLocation: 'device',
    autoBackup: true,

    // Asset settings
    svgCacheSize: '50MB',
    autoCleanup: true
  });

  if (!isOpen) return null;

  const sections = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'projects', name: 'Projects', icon: '📁' },
    { id: 'assets', name: 'Assets', icon: '🎨' },
    { id: 'camera', name: 'Camera', icon: '📷' },
    { id: 'calibration', name: 'Calibration', icon: '📐' },
    { id: 'diagnostics', name: 'Diagnostics', icon: '🔧' }
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`absolute right-0 top-0 h-full ${isMobile ? 'w-full' : 'w-96'} bg-slate-900 ${isMobile ? '' : 'border-l border-slate-700'} flex flex-col`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-white`}>Settings</h2>
          <button
            onClick={onClose}
            className={`${isMobile ? 'w-10 h-10 min-w-[44px] min-h-[44px]' : 'w-8 h-8'} rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-all flex items-center justify-center`}
          >
            ✕
          </button>
        </div>

        {/* Section Navigation */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700">
          <div className="grid grid-cols-3 gap-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`p-3 rounded-lg text-xs font-medium transition-all ${
                  activeSection === section.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="text-lg mb-1">{section.icon}</div>
                <div>{section.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSection === 'general' && (
            <GeneralSettingsSection settings={settings} setSettings={setSettings} />
          )}
          {activeSection === 'projects' && (
            <ProjectSettingsSection
              projectName={projectName}
              setProjectName={setProjectName}
              svgLayers={svgLayers}
              settings={settings}
              setSettings={setSettings}
            />
          )}
          {activeSection === 'assets' && (
            <AssetSettingsSection
              settings={settings}
              setSettings={setSettings}
              onSVGUpload={onSVGUpload}
            />
          )}
          {activeSection === 'camera' && (
            <CameraSettingsSection camera={camera} settings={settings} setSettings={setSettings} />
          )}
          {activeSection === 'calibration' && (
            <CalibrationSettingsSection calibration={calibration} />
          )}
          {activeSection === 'diagnostics' && (
            <DiagnosticsSection
              logger={logger}
              viewportSize={viewportSize}
              screenOrientation={screenOrientation}
              isMobile={isMobile}
              setShowLogsViewer={setShowLogsViewer}
              setShowSettingsPanel={setShowSettingsPanel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SignSizerApp() {
  console.log('SignSizerApp component rendering...');

  // Simple error boundary for this component
  const [componentError, setComponentError] = useState(null);

  useEffect(() => {
    const handleComponentError = (error) => {
      console.error('SignSizerApp Error:', error);
      setComponentError(error.message);
    };

    window.addEventListener('error', handleComponentError);
    return () => window.removeEventListener('error', handleComponentError);
  }, []);

  if (componentError) {
    return (
      <div className="min-h-screen w-full bg-red-800 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Component Error</h1>
          <p className="mb-4">SignSizerApp failed to load: {componentError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE MANAGEMENT - Using custom hooks for clean separation
  // ============================================================================

  const canvasRef = useRef(null);
  const stageRef = useRef(null);

  // AR-specific state
  const [simpleMode, setSimpleMode] = useState(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const [showSVGLibrary, setShowSVGLibrary] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showLogsViewer, setShowLogsViewer] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Site");

  // Mobile responsiveness state
  const [isMobile, setIsMobile] = useState(false);
  const [screenOrientation, setScreenOrientation] = useState('portrait');
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Initialize logger
  const logger = useApplicationLogger();

  // Global error handling for unhandled errors
  useEffect(() => {
    const handleGlobalError = (event) => {
      logger.logError(new Error(event.message), `Global error at ${event.filename}:${event.lineno}`);
    };

    const handleUnhandledRejection = (event) => {
      logger.logError(new Error(event.reason), 'Unhandled promise rejection');
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [logger]);

  // Mobile responsiveness detection and handling
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);

      // Detect orientation
      const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      setScreenOrientation(orientation);

      // Update viewport size
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });

      logger.logUserAction('viewport_change', {
        is_mobile: isMobileDevice || isSmallScreen,
        orientation,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        user_agent: userAgent
      });
    };

    checkMobile();

    const handleResize = () => {
      checkMobile();
    };

    const handleOrientationChange = () => {
      setTimeout(checkMobile, 100); // Delay to ensure dimensions are updated
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [logger]);

  // Custom hooks for modular functionality - with error handling
  let calibration, camera, svgLayers, touchGestures, projectManager, exportSystem;

  try {
    calibration = useCalibration();
    camera = useCamera();
    svgLayers = useSVGLayers(simpleMode, calibration.pxPerMM);
    touchGestures = useTouchGestures(svgLayers.layers, svgLayers.setLayers, svgLayers.activeId, stageRef);
    projectManager = useProjectManagement();
    exportSystem = useAdvancedExport();

    console.log('All hooks initialized successfully');
  } catch (error) {
    console.error('Hook initialization error:', error);
    setComponentError(`Hook initialization failed: ${error.message}`);
    return null;
  }

  // ============================================================================
  // EVENT HANDLERS - AR-specific interactions
  // ============================================================================

  // Stage click for calibration points
  const handleStageClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    calibration.addCalibPoint(x, y);
  }, [calibration]);

  // Wheel zoom for active layer
  const handleWheel = useCallback((e) => {
    if (!svgLayers.activeId) return;
    e.preventDefault();
    svgLayers.setLayers(ls => ls.map(l =>
      l.id === svgLayers.activeId ? {
        ...l,
        scale: Math.max(0.05, l.scale * (e.deltaY > 0 ? 0.95 : 1.05))
      } : l
    ));
  }, [svgLayers.activeId, svgLayers.setLayers]);

  // Button handlers for AR controls
  const handleSVGSelect = useCallback(() => {
    setShowSVGLibrary(true);
    logger.logUserAction('svg_library_open', { action: 'open_svg_library' });
  }, [logger]);

  // SVG Library handlers
  const handleSVGFromLibrary = useCallback((file) => {
    svgLayers.addSVGLayer(file);
    logger.logUserAction('svg_add_from_library', {
      file_name: file.name,
      file_size: file.size,
      layer_count: svgLayers.layers.length + 1
    });
  }, [svgLayers, logger]);

  const handleSVGUpload = useCallback((file) => {
    svgLayers.addSVGLayer(file);
    logger.logUserAction('svg_upload_custom', {
      file_name: file.name,
      file_size: file.size,
      layer_count: svgLayers.layers.length + 1
    });
  }, [svgLayers, logger]);

  // Enhanced camera handlers
  const handleCameraOptions = useCallback(() => {
    setShowCameraOptions(true);
  }, []);

  // Project management handlers
  const handleProjectManager = useCallback(() => {
    setShowProjectManager(true);
  }, []);

  const handleSaveProject = useCallback(async () => {
    try {
      const projectData = await projectManager.saveProject(
        projectName,
        svgLayers.layers,
        calibration,
        camera,
        "Auto-saved project"
      );
      alert(`Project "${projectData.name}" saved successfully!`);
    } catch (error) {
      alert(`Failed to save project: ${error.message}`);
    }
  }, [projectManager, projectName, svgLayers.layers, calibration, camera]);

  const handleLoadProject = useCallback(async (projectId) => {
    try {
      const project = await projectManager.loadProject(projectId);

      // Apply loaded project data
      setProjectName(project.name);
      svgLayers.setLayers(project.layers);
      svgLayers.setActiveId(project.layers[0]?.id || null);

      // Apply calibration data
      calibration.setCalibPoints(project.calibration.points);
      calibration.setCalibDistanceMM(project.calibration.distanceMM);

      setShowProjectManager(false);
      alert(`Project "${project.name}" loaded successfully!`);
    } catch (error) {
      alert(`Failed to load project: ${error.message}`);
    }
  }, [projectManager, setProjectName, svgLayers, calibration]);

  const handleDeleteProject = useCallback(async (projectId) => {
    try {
      const result = await projectManager.deleteProject(projectId);
      logger.logUserAction('project_delete', {
        project_id: projectId,
        project_name: result.deletedProject.name
      });
      // Note: No alert for delete success to keep UI clean
    } catch (error) {
      logger.logUserAction('project_delete_failed', {
        project_id: projectId,
        error: error.message
      }, false, error);
      alert(`Failed to delete project: ${error.message}`);
    }
  }, [projectManager, logger]);

  // Advanced export handlers
  const handleAdvancedExport = useCallback(() => {
    setShowExportPanel(true);
  }, []);

  const handleExport = useCallback(async (exportConfig) => {
    if (!svgLayers.layers.length) {
      alert("No layers to export. Please add some SVG elements first.");
      return;
    }

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const rect = stageRef.current.getBoundingClientRect();

      // Prepare canvas for export
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);

      // Draw background
      if (camera.useCamera && camera.videoRef.current) {
        ctx.drawImage(camera.videoRef.current, 0, 0, canvas.width, canvas.height);
      } else if (camera.bgImage) {
        ctx.drawImage(camera.bgImage, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw SVG layers
      for (const layer of svgLayers.layers) {
        const img = new Image();
        img.src = layer.url;
        await new Promise(resolve => {
          img.onload = () => {
            ctx.save();
            ctx.translate(layer.x + 50, layer.y + 50);
            ctx.rotate((layer.rot * Math.PI) / 180);
            ctx.scale(layer.scale, layer.scale);
            ctx.globalAlpha = layer.opacity;
            ctx.drawImage(img, -50, -50, 100, 100);
            ctx.restore();
            resolve();
          };
        });
      }

      // Get current project data for export
      const currentProjectData = projectManager.createProjectMetadata(
        projectName,
        svgLayers.layers,
        calibration,
        camera
      );

      // Perform export based on format
      let exportResult;
      if (exportConfig.format === 'png') {
        const preset = exportSystem.exportPresets.find(p => p.id === exportConfig.preset);
        exportResult = await exportSystem.exportPNG(canvas, preset, currentProjectData);
      } else if (exportConfig.format === 'pdf') {
        exportResult = await exportSystem.exportPDF(canvas, currentProjectData, calibration);
      }

      // Handle the export result
      if (exportResult) {
        if (exportResult.format === 'png') {
          // Save PNG to device
          try {
            const base64 = exportResult.dataUrl.split(",")[1];
            await Filesystem.mkdir({ directory: Directory.Pictures, path: "LaserSign" }).catch(() => {});
            await Filesystem.writeFile({
              directory: Directory.Pictures,
              path: `LaserSign/${exportResult.fileName}`,
              data: base64
            });
            alert(`Exported: Gallery/Pictures/LaserSign/${exportResult.fileName}`);
          } catch (e) {
            // Fallback to browser download
            const a = document.createElement("a");
            a.download = exportResult.fileName;
            a.href = exportResult.dataUrl;
            a.click();
          }
        } else if (exportResult.format === 'pdf') {
          // Handle PDF export (would need PDF library integration)
          console.log('PDF Export Data:', exportResult.pdfData);
          alert(`PDF documentation prepared: ${exportResult.fileName}`);
        }
      }

      setShowExportPanel(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  }, [svgLayers, camera, canvasRef, stageRef, projectManager, projectName, calibration, exportSystem]);

  const handleStartCamera = useCallback(async () => {
    logger.logCameraOperation('start_camera_attempt', { permission_state: camera.permissionState });

    // Check permissions first
    if (camera.permissionState === 'denied') {
      const granted = await camera.requestCameraPermission();
      if (!granted) {
        logger.logCameraOperation('start_camera_failed', { reason: 'permission_denied' }, false);
        return;
      }
    }

    camera.setUseCamera(true);
    setShowCameraOptions(false);
    logger.logCameraOperation('start_camera_success', { use_camera: true });
  }, [camera, logger]);

  const handleCapturePhoto = useCallback(async () => {
    try {
      logger.logCameraOperation('capture_photo_attempt', {});
      await camera.capturePhoto();
      logger.logCameraOperation('capture_photo_success', {});
    } catch (error) {
      logger.logCameraOperation('capture_photo_failed', { error: error.message }, false, error);
    }
  }, [camera, logger]);

  const handlePickPhoto = useCallback((file) => {
    logger.logCameraOperation('pick_photo', {
      file_name: file.name,
      file_size: file.size,
      file_type: file.type
    });
    camera.onPickPhoto(file);
  }, [camera, logger]);

  const handleCapture = useCallback(async () => {
    if (!svgLayers.layers.length) return;

    // Export functionality preserved from original
    if (!canvasRef.current || !stageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = stageRef.current.getBoundingClientRect();

    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);

    // Draw background
    if (camera.useCamera && camera.videoRef.current) {
      ctx.drawImage(camera.videoRef.current, 0, 0, canvas.width, canvas.height);
    } else if (camera.bgImage) {
      ctx.drawImage(camera.bgImage, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw SVG layers
    for (const layer of svgLayers.layers) {
      const img = await loadImageFromURL(layer.url);
      const { wpx, hpx } = svgLayers.layerSizePX(layer);

      ctx.save();
      const cx = layer.x + wpx / 2;
      const cy = layer.y + hpx / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rot * Math.PI) / 180);
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(img, -wpx / 2, -hpx / 2, wpx, hpx);
      ctx.restore();
    }

    // Save to device
    const dataUrl = canvas.toDataURL("image/png");
    try {
      const base64 = dataUrl.split(",")[1];
      const fileName = `LaserSignViz_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      await Filesystem.mkdir({ directory: Directory.Pictures, path: "LaserSign" }).catch(() => {});
      await Filesystem.writeFile({
        directory: Directory.Pictures,
        path: `LaserSign/${fileName}`,
        data: base64
      });
      alert(`Saved: Gallery/Pictures/LaserSign/${fileName}`);
    } catch (e) {
      // Fallback to browser download
      const a = document.createElement("a");
      a.download = "laser-sign-preview.png";
      a.href = dataUrl;
      a.click();
    }
  }, [svgLayers, camera, canvasRef, stageRef]);

  // ============================================================================
  // MAIN RENDER - New AR Layout Architecture
  // ============================================================================

  console.log('SignSizerApp rendering with camera state:', {
    useCamera: camera.useCamera,
    bgImage: !!camera.bgImage,
    isLoading: camera.isLoading,
    cameraError: camera.cameraError
  });

  return (
    <>
      {/* Hidden canvas for export functionality */}
      <canvas ref={canvasRef} className="hidden" />

      {/* AR Navigation Bar */}
      <ARNavigationBar
        pxPerMM={calibration.pxPerMM}
        projectName={projectName}
        onMenuToggle={() => {
          setShowSettingsPanel(!showSettingsPanel);
          logger.logUserAction('navigation_menu_toggle', { action: showSettingsPanel ? 'close_settings' : 'open_settings' });
        }}
        onProjectManager={handleProjectManager}
        onSaveProject={handleSaveProject}
        onAdvancedExport={handleAdvancedExport}
        logger={logger}
        isMobile={isMobile}
      />

      {/* Full-Screen AR Camera Background with Fallback */}
      <div className="absolute inset-0 bg-slate-900">
        <ARCameraBackground
          useCamera={camera.useCamera}
          videoRef={camera.videoRef}
          bgImage={camera.bgImage}
          bgImageFit={camera.bgImageFit}
          isLoading={camera.isLoading}
          cameraError={camera.cameraError}
          permissionState={camera.permissionState}
          onRequestPermission={camera.requestCameraPermission}
          onClearImage={() => {
            camera.clearBackgroundImage();
            logger.logCameraOperation('clear_background_image', { source: camera.getImageSource() });
          }}
          onShowCameraOptions={() => setShowCameraOptions(true)}
          isMobile={isMobile}
        />
      </div>

      {/* AR Overlay Stage for SVG Manipulation */}
      <AROverlayStage
        stageRef={stageRef}
        onStageClick={handleStageClick}
        touchGestures={touchGestures}
        onWheel={handleWheel}
        activeLayerId={svgLayers.activeId}
        pxPerMM={calibration.pxPerMM}
        isMobile={isMobile}
      >
        {/* Calibration Points Overlay */}
        {calibration.calibPoints.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 w-full h-full">
            {calibration.calibPoints.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={12}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth={3}
                  opacity={0.9}
                />
                <circle cx={p.x} cy={p.y} r={6} fill="#ffffff" opacity={0.8} />
                <text
                  x={p.x}
                  y={p.y - 20}
                  textAnchor="middle"
                  fill="#10b981"
                  fontSize="14"
                  fontWeight="bold"
                  className="drop-shadow-lg"
                >
                  {i + 1}
                </text>
              </g>
            ))}
            {calibration.calibPoints.length === 2 && (
              <g>
                <line
                  x1={calibration.calibPoints[0].x}
                  y1={calibration.calibPoints[0].y}
                  x2={calibration.calibPoints[1].x}
                  y2={calibration.calibPoints[1].y}
                  stroke="#10b981"
                  strokeWidth={4}
                  opacity={0.8}
                  strokeDasharray="8,8"
                />
                <line
                  x1={calibration.calibPoints[0].x}
                  y1={calibration.calibPoints[0].y}
                  x2={calibration.calibPoints[1].x}
                  y2={calibration.calibPoints[1].y}
                  stroke="#ffffff"
                  strokeWidth={2}
                  opacity={0.6}
                />
              </g>
            )}
          </svg>
        )}

        {/* PERFORMANCE OPTIMIZED: SVG Layers Rendering with React.memo */}
        {svgLayers.layers.map(layer => (
          <MemoizedSVGLayer
            key={layer.id}
            layer={layer}
            isActive={svgLayers.activeId === layer.id}
            layerSizePX={svgLayers.layerSizePX}
            touchGestures={touchGestures}
            setActiveId={svgLayers.setActiveId}
            pxPerMM={calibration.pxPerMM}
          />
        ))}

        {/* Professional Measurement Tools */}
        <MeasurementTools
          layers={svgLayers.layers}
          pxPerMM={calibration.pxPerMM}
          showMeasurements={touchGestures.showMeasurements}
        />
      </AROverlayStage>

      {/* AR Bottom Controls */}
      <ARBottomControls
        onSVGSelect={handleSVGSelect}
        onCameraOptions={handleCameraOptions}
        onCapture={handleCapture}
        hasLayers={svgLayers.layers.length > 0}
        useCamera={camera.useCamera}
        disabled={false}
        logger={logger}
        isMobile={isMobile}
      />

      {/* New SVG Control Panel - Bottom Right */}
      <SVGControlPanel
        activeLayer={svgLayers.activeLayer}
        onRotate={(degrees) => {
          if (svgLayers.activeId) {
            svgLayers.setLayers(ls => ls.map(l =>
              l.id === svgLayers.activeId ? { ...l, rot: (l.rot + degrees) % 360 } : l
            ));
            logger.logGesture('rotate_button', { degrees, layer_id: svgLayers.activeId });
          }
        }}
        onSizeChange={(mmChange) => {
          if (svgLayers.activeId && calibration.pxPerMM) {
            svgLayers.setLayers(ls => ls.map(l => {
              if (l.id === svgLayers.activeId) {
                // Calculate new scale based on mm change
                const currentHeightMM = l.originalHeight * l.scale;
                const newHeightMM = Math.max(10, currentHeightMM + mmChange); // Minimum 10mm
                const newScale = newHeightMM / l.originalHeight;

                return { ...l, scale: Math.max(0.1, Math.min(10, newScale)) }; // Scale limits
              }
              return l;
            }));
            logger.logGesture('size_button', { mmChange, layer_id: svgLayers.activeId });
          }
        }}
        onMove={(direction) => {
          if (svgLayers.activeId) {
            const movePixels = 20; // Predefined pixel increment

            svgLayers.setLayers(ls => ls.map(l => {
              if (l.id === svgLayers.activeId) {
                switch (direction) {
                  case 'up':
                    return { ...l, y: Math.max(0, l.y - movePixels) };
                  case 'down':
                    return { ...l, y: l.y + movePixels };
                  case 'left':
                    return { ...l, x: Math.max(0, l.x - movePixels) };
                  case 'right':
                    return { ...l, x: l.x + movePixels };
                  default:
                    return l;
                }
              }
              return l;
            }));
            logger.logGesture('move_button', { direction, pixels: movePixels, layer_id: svgLayers.activeId });
          }
        }}
        onDelete={() => {
          if (svgLayers.activeId) {
            svgLayers.setLayers(ls => ls.filter(l => l.id !== svgLayers.activeId));
            svgLayers.setActiveId(null);
            logger.logUserAction('svg_delete', { layer_id: svgLayers.activeId });
          }
        }}
        onAddSVG={handleSVGSelect}
        isMobile={isMobile}
        logger={logger}
      />

      {/* Real-time Dimension Feedback Overlay */}
      {(touchGestures.touchState.isGesturing || touchGestures.dragging || touchGestures.resizing || touchGestures.rotating) && svgLayers.activeLayer && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/90 text-white px-8 py-6 rounded-2xl z-50 backdrop-blur-sm border border-white/30 shadow-2xl">
          <div className="text-center">
            <div className="text-sm text-gray-300 mb-2">Original Size</div>
            <div className="text-xl font-bold text-emerald-400 mb-4">
              {svgLayers.getDimensionFeedback(svgLayers.activeLayer).original}
            </div>
            <div className="text-sm text-gray-300 mb-2">Current Size</div>
            <div className="text-xl font-bold text-white mb-4">
              {svgLayers.getDimensionFeedback(svgLayers.activeLayer).current}
            </div>
            <div className="text-3xl font-bold text-yellow-400">
              {svgLayers.getDimensionFeedback(svgLayers.activeLayer).scale}
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Settings Panel - Redesigned for Samsung S20+ */}
      {showSettingsPanel && (
        <ComprehensiveSettingsPanel
          isOpen={showSettingsPanel}
          onClose={() => setShowSettingsPanel(false)}
          isMobile={isMobile}
          calibration={calibration}
          projectName={projectName}
          setProjectName={setProjectName}
          svgLayers={svgLayers}
          camera={camera}
          logger={logger}
          viewportSize={viewportSize}
          screenOrientation={screenOrientation}
          setShowLogsViewer={setShowLogsViewer}
          setShowSettingsPanel={setShowSettingsPanel}
          onSVGUpload={handleSVGUpload}
        />
      )}



      {/* Camera Options Panel */}
      <CameraOptionsPanel
        isOpen={showCameraOptions}
        onClose={() => setShowCameraOptions(false)}
        camera={camera}
        onStartCamera={handleStartCamera}
        onCapturePhoto={handleCapturePhoto}
        onPickPhoto={handlePickPhoto}
      />

      {/* SVG Library Panel */}
      <SVGLibraryPanel
        isOpen={showSVGLibrary}
        onClose={() => setShowSVGLibrary(false)}
        onSelectSVG={handleSVGFromLibrary}
        onUploadSVG={handleSVGUpload}
        isMobile={isMobile}
      />

      {/* Project Management Panel */}
      <ProjectManagementPanel
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        projectManager={projectManager}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        isMobile={isMobile}
      />

      {/* Advanced Export Panel */}
      <AdvancedExportPanel
        isOpen={showExportPanel}
        onClose={() => setShowExportPanel(false)}
        exportSystem={exportSystem}
        onExport={handleExport}
      />

      {/* Application Logs Viewer */}
      <LogsViewer
        isOpen={showLogsViewer}
        onClose={() => setShowLogsViewer(false)}
        logger={logger}
      />
    </>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
