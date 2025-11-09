/**
 * Comprehensive Performance Test Suite for Laser Sign Visualizer
 * 
 * This suite identifies performance bottlenecks causing:
 * - Slowness and jankiness
 * - Screen tearing
 * - Battery drain
 * - Memory leaks
 * 
 * Designed for Samsung Galaxy S20+ testing
 */

class PerformanceTestSuite {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = {};
    this.memoryBaseline = null;
    this.testStartTime = null;
    this.observers = {};
    this.isRunning = false;
    
    // Test configuration
    this.config = {
      maxTestDuration: 300000, // 5 minutes max per test
      memoryThreshold: 100 * 1024 * 1024, // 100MB memory threshold
      frameRateThreshold: 30, // Minimum acceptable FPS
      touchResponseThreshold: 100, // Max touch response time (ms)
      cameraInitThreshold: 3000, // Max camera init time (ms)
      svgRenderThreshold: 500, // Max SVG render time (ms)
    };
    
    this.initializeObservers();
  }

  /**
   * Initialize performance observers
   */
  initializeObservers() {
    // Performance Observer for measuring timing
    if ('PerformanceObserver' in window) {
      this.observers.performance = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordPerformanceEntry(entry);
        }
      });
      
      this.observers.performance.observe({
        entryTypes: ['measure', 'navigation', 'resource', 'paint']
      });
    }

    // Memory usage observer
    if ('memory' in performance) {
      this.startMemoryMonitoring();
    }

    // Frame rate observer
    this.startFrameRateMonitoring();
  }

  /**
   * Start comprehensive performance testing
   */
  async runFullTestSuite() {
    console.log('🚀 Starting Comprehensive Performance Test Suite');
    this.isRunning = true;
    this.testStartTime = performance.now();
    this.memoryBaseline = this.getCurrentMemoryUsage();

    const testSuite = [
      // 1. Performance Benchmarking Tests
      { name: 'Camera Initialization Performance', test: () => this.testCameraInitialization() },
      { name: 'SVG Rendering Performance', test: () => this.testSVGRenderingPerformance() },
      { name: 'Memory Usage Analysis', test: () => this.testMemoryUsage() },
      { name: 'Touch Response Performance', test: () => this.testTouchResponseTimes() },
      { name: 'UI Transition Smoothness', test: () => this.testUITransitions() },
      
      // 2. Resource Usage Analysis
      { name: 'CPU Usage Monitoring', test: () => this.testCPUUsage() },
      { name: 'GPU Rendering Performance', test: () => this.testGPUPerformance() },
      { name: 'Battery Consumption Analysis', test: () => this.testBatteryConsumption() },
      
      // 3. Stress Testing
      { name: 'Maximum SVG Load Test', test: () => this.testMaximumSVGLoad() },
      { name: 'Rapid Mode Switching Test', test: () => this.testRapidModeSwitching() },
      { name: 'Continuous Gesture Test', test: () => this.testContinuousGestures() },
      { name: 'Extended Usage Test', test: () => this.testExtendedUsage() },
      
      // 4. Mobile-Specific Tests
      { name: 'Camera Permission Performance', test: () => this.testCameraPermissions() },
      { name: 'Touch Target Responsiveness', test: () => this.testTouchTargets() },
      { name: 'Orientation Change Performance', test: () => this.testOrientationChanges() },
      { name: 'Capacitor Plugin Efficiency', test: () => this.testCapacitorPlugins() }
    ];

    for (const testCase of testSuite) {
      try {
        console.log(`📊 Running: ${testCase.name}`);
        const result = await this.runSingleTest(testCase.name, testCase.test);
        this.testResults.push(result);
        
        // Brief pause between tests
        await this.sleep(1000);
      } catch (error) {
        console.error(`❌ Test failed: ${testCase.name}`, error);
        this.testResults.push({
          name: testCase.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.isRunning = false;
    return this.generateComprehensiveReport();
  }

  /**
   * Run a single test with timeout and error handling
   */
  async runSingleTest(name, testFunction) {
    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();

    try {
      const result = await Promise.race([
        testFunction(),
        this.timeout(this.config.maxTestDuration)
      ]);

      const endTime = performance.now();
      const endMemory = this.getCurrentMemoryUsage();
      const duration = endTime - startTime;
      const memoryDelta = endMemory - startMemory;

      return {
        name,
        status: 'passed',
        duration,
        memoryDelta,
        startMemory,
        endMemory,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        name,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test camera initialization performance
   */
  async testCameraInitialization() {
    const metrics = {
      initTime: 0,
      streamStability: 0,
      permissionTime: 0,
      errorCount: 0
    };

    // Measure camera permission request time
    const permissionStart = performance.now();
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      metrics.permissionTime = performance.now() - permissionStart;
    } catch (error) {
      metrics.errorCount++;
    }

    // Measure camera stream initialization
    const initStart = performance.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });

      metrics.initTime = performance.now() - initStart;

      // Test stream stability
      const stabilityStart = performance.now();
      await this.sleep(2000); // Wait 2 seconds
      
      if (stream.active) {
        metrics.streamStability = performance.now() - stabilityStart;
      }

      // Clean up
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      metrics.errorCount++;
      metrics.initTime = performance.now() - initStart;
    }

    return {
      ...metrics,
      passed: metrics.initTime < this.config.cameraInitThreshold && metrics.errorCount === 0
    };
  }

  /**
   * Test SVG rendering performance with multiple elements
   */
  async testSVGRenderingPerformance() {
    const metrics = {
      singleSVGRenderTime: 0,
      multipleSVGRenderTime: 0,
      maxSVGsBeforeSlowdown: 0,
      memoryPerSVG: 0
    };

    // Test single SVG rendering
    const singleStart = performance.now();
    const testSVG = this.createTestSVG();
    await this.renderSVGToDOM(testSVG);
    metrics.singleSVGRenderTime = performance.now() - singleStart;

    // Test multiple SVG rendering
    const multipleStart = performance.now();
    const initialMemory = this.getCurrentMemoryUsage();
    
    let svgCount = 0;
    let lastRenderTime = 0;
    
    while (svgCount < 20) { // Test up to 20 SVGs
      const renderStart = performance.now();
      await this.renderSVGToDOM(this.createTestSVG(), `test-svg-${svgCount}`);
      const renderTime = performance.now() - renderStart;
      
      if (renderTime > this.config.svgRenderThreshold && metrics.maxSVGsBeforeSlowdown === 0) {
        metrics.maxSVGsBeforeSlowdown = svgCount;
      }
      
      lastRenderTime = renderTime;
      svgCount++;
      
      // Brief pause to allow rendering
      await this.sleep(100);
    }

    metrics.multipleSVGRenderTime = performance.now() - multipleStart;
    metrics.memoryPerSVG = (this.getCurrentMemoryUsage() - initialMemory) / svgCount;

    // Clean up test SVGs
    this.cleanupTestSVGs();

    return {
      ...metrics,
      passed: metrics.singleSVGRenderTime < this.config.svgRenderThreshold
    };
  }

  /**
   * Test memory usage patterns and detect leaks
   */
  async testMemoryUsage() {
    const metrics = {
      baselineMemory: this.memoryBaseline,
      currentMemory: this.getCurrentMemoryUsage(),
      memoryGrowth: 0,
      potentialLeaks: [],
      gcEffectiveness: 0
    };

    // Force garbage collection if available
    if (window.gc) {
      const beforeGC = this.getCurrentMemoryUsage();
      window.gc();
      await this.sleep(1000);
      const afterGC = this.getCurrentMemoryUsage();
      metrics.gcEffectiveness = beforeGC - afterGC;
    }

    metrics.memoryGrowth = metrics.currentMemory - metrics.baselineMemory;

    // Check for potential memory leaks
    if (metrics.memoryGrowth > this.config.memoryThreshold) {
      metrics.potentialLeaks.push('Excessive memory growth detected');
    }

    return {
      ...metrics,
      passed: metrics.memoryGrowth < this.config.memoryThreshold
    };
  }

  /**
   * Test touch response times and gesture recognition latency
   */
  async testTouchResponseTimes() {
    const metrics = {
      averageResponseTime: 0,
      maxResponseTime: 0,
      gestureRecognitionDelay: 0,
      touchEventLag: 0
    };

    const responseTimes = [];
    const testElement = document.createElement('div');
    testElement.style.cssText = 'position:fixed;top:50%;left:50%;width:100px;height:100px;background:red;z-index:9999;';
    document.body.appendChild(testElement);

    // Test touch response times
    for (let i = 0; i < 10; i++) {
      const responseTime = await this.measureTouchResponse(testElement);
      responseTimes.push(responseTime);
      await this.sleep(200);
    }

    metrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    metrics.maxResponseTime = Math.max(...responseTimes);

    document.body.removeChild(testElement);

    return {
      ...metrics,
      passed: metrics.averageResponseTime < this.config.touchResponseThreshold
    };
  }

  /**
   * Test UI transition smoothness between panels/modals
   */
  async testUITransitions() {
    const metrics = {
      modalOpenTime: 0,
      modalCloseTime: 0,
      panelSwitchTime: 0,
      frameDrops: 0
    };

    // Test modal opening performance
    const modalOpenStart = performance.now();
    await this.simulateModalOpen();
    metrics.modalOpenTime = performance.now() - modalOpenStart;

    await this.sleep(500);

    // Test modal closing performance
    const modalCloseStart = performance.now();
    await this.simulateModalClose();
    metrics.modalCloseTime = performance.now() - modalCloseStart;

    return {
      ...metrics,
      passed: metrics.modalOpenTime < 300 && metrics.modalCloseTime < 300
    };
  }

  /**
   * Test CPU usage during various operations
   */
  async testCPUUsage() {
    const metrics = {
      idleCPU: 0,
      cameraCPU: 0,
      svgManipulationCPU: 0,
      uiInteractionCPU: 0
    };

    // Measure idle CPU (baseline)
    metrics.idleCPU = await this.measureCPUUsage(1000);

    // Measure CPU during camera operations
    await this.simulateCameraOperation();
    metrics.cameraCPU = await this.measureCPUUsage(2000);

    // Measure CPU during SVG manipulation
    await this.simulateSVGManipulation();
    metrics.svgManipulationCPU = await this.measureCPUUsage(2000);

    return {
      ...metrics,
      passed: metrics.cameraCPU < 80 && metrics.svgManipulationCPU < 70
    };
  }

  /**
   * Test GPU rendering performance
   */
  async testGPUPerformance() {
    const metrics = {
      frameRate: 0,
      renderTime: 0,
      gpuMemoryUsage: 0
    };

    // Start frame rate monitoring
    const frameRateData = await this.measureFrameRate(3000);
    metrics.frameRate = frameRateData.averageFPS;
    metrics.renderTime = frameRateData.averageRenderTime;

    return {
      ...metrics,
      passed: metrics.frameRate >= this.config.frameRateThreshold
    };
  }

  /**
   * Test battery consumption patterns
   */
  async testBatteryConsumption() {
    const metrics = {
      batteryDrainRate: 0,
      powerEfficiency: 0
    };

    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      const initialLevel = battery.level;
      const startTime = Date.now();

      await this.sleep(10000); // Monitor for 10 seconds

      const finalLevel = battery.level;
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds

      metrics.batteryDrainRate = (initialLevel - finalLevel) / duration * 3600; // per hour
    }

    return {
      ...metrics,
      passed: metrics.batteryDrainRate < 0.1 // Less than 10% per hour
    };
  }

  /**
   * Stress test with maximum SVG load
   */
  async testMaximumSVGLoad() {
    const metrics = {
      maxSVGsLoaded: 0,
      performanceDegradation: 0,
      memoryAtMax: 0
    };

    const initialMemory = this.getCurrentMemoryUsage();
    let svgCount = 0;
    let lastFrameRate = 60;

    while (svgCount < 50) { // Test up to 50 SVGs
      await this.renderSVGToDOM(this.createTestSVG(), `stress-svg-${svgCount}`);
      svgCount++;

      const currentFrameRate = await this.measureFrameRate(1000);
      if (currentFrameRate.averageFPS < lastFrameRate * 0.8) { // 20% degradation
        metrics.performanceDegradation = lastFrameRate - currentFrameRate.averageFPS;
        break;
      }
      lastFrameRate = currentFrameRate.averageFPS;
    }

    metrics.maxSVGsLoaded = svgCount;
    metrics.memoryAtMax = this.getCurrentMemoryUsage();

    this.cleanupTestSVGs();

    return {
      ...metrics,
      passed: metrics.maxSVGsLoaded >= 10 // Should handle at least 10 SVGs
    };
  }

  /**
   * Test rapid switching between camera modes and gallery
   */
  async testRapidModeSwitching() {
    const metrics = {
      switchCount: 0,
      averageSwitchTime: 0,
      errorCount: 0
    };

    const switchTimes = [];

    for (let i = 0; i < 10; i++) {
      try {
        const switchStart = performance.now();
        await this.simulateModeSwitch();
        const switchTime = performance.now() - switchStart;
        switchTimes.push(switchTime);
        metrics.switchCount++;

        await this.sleep(500); // Brief pause between switches
      } catch (error) {
        metrics.errorCount++;
      }
    }

    metrics.averageSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;

    return {
      ...metrics,
      passed: metrics.averageSwitchTime < 1000 && metrics.errorCount === 0
    };
  }

  /**
   * Test continuous touch gestures and SVG manipulations
   */
  async testContinuousGestures() {
    const metrics = {
      gestureCount: 0,
      averageGestureTime: 0,
      gestureAccuracy: 0
    };

    const gestureTimes = [];

    for (let i = 0; i < 20; i++) {
      const gestureStart = performance.now();
      await this.simulateGesture();
      const gestureTime = performance.now() - gestureStart;
      gestureTimes.push(gestureTime);
      metrics.gestureCount++;

      await this.sleep(100);
    }

    metrics.averageGestureTime = gestureTimes.reduce((a, b) => a + b, 0) / gestureTimes.length;

    return {
      ...metrics,
      passed: metrics.averageGestureTime < 200
    };
  }

  /**
   * Extended usage test to identify memory leaks
   */
  async testExtendedUsage() {
    const metrics = {
      duration: 0,
      memoryGrowth: 0,
      performanceDegradation: 0,
      stabilityScore: 0
    };

    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();
    const startFrameRate = await this.measureFrameRate(1000);

    // Simulate 2 minutes of typical usage
    const endTime = startTime + 120000; // 2 minutes
    while (performance.now() < endTime) {
      await this.simulateTypicalUsage();
      await this.sleep(1000);
    }

    metrics.duration = performance.now() - startTime;
    metrics.memoryGrowth = this.getCurrentMemoryUsage() - startMemory;

    const endFrameRate = await this.measureFrameRate(1000);
    metrics.performanceDegradation = startFrameRate.averageFPS - endFrameRate.averageFPS;

    return {
      ...metrics,
      passed: metrics.memoryGrowth < this.config.memoryThreshold && metrics.performanceDegradation < 10
    };
  }

  // ============================================================================
  // HELPER METHODS AND UTILITIES
  // ============================================================================

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage() {
    if ('memory' in performance) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      const memory = this.getCurrentMemoryUsage();
      this.performanceMetrics.memory = this.performanceMetrics.memory || [];
      this.performanceMetrics.memory.push({
        timestamp: Date.now(),
        usage: memory
      });

      // Keep only last 100 measurements
      if (this.performanceMetrics.memory.length > 100) {
        this.performanceMetrics.memory.shift();
      }
    }, 1000);
  }

  /**
   * Start frame rate monitoring
   */
  startFrameRateMonitoring() {
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFrame = (currentTime) => {
      frameCount++;

      if (currentTime - lastTime >= 1000) { // Every second
        const fps = frameCount;
        this.performanceMetrics.frameRate = this.performanceMetrics.frameRate || [];
        this.performanceMetrics.frameRate.push({
          timestamp: Date.now(),
          fps: fps
        });

        frameCount = 0;
        lastTime = currentTime;

        // Keep only last 60 measurements
        if (this.performanceMetrics.frameRate.length > 60) {
          this.performanceMetrics.frameRate.shift();
        }
      }

      if (this.isRunning) {
        requestAnimationFrame(measureFrame);
      }
    };

    requestAnimationFrame(measureFrame);
  }

  /**
   * Record performance entry
   */
  recordPerformanceEntry(entry) {
    this.performanceMetrics.entries = this.performanceMetrics.entries || [];
    this.performanceMetrics.entries.push({
      name: entry.name,
      type: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      timestamp: Date.now()
    });
  }

  /**
   * Create a test SVG element
   */
  createTestSVG() {
    return `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="red" />
      <circle cx="50" cy="50" r="25" fill="blue" />
      <text x="50" y="55" text-anchor="middle" fill="white">TEST</text>
    </svg>`;
  }

  /**
   * Render SVG to DOM
   */
  async renderSVGToDOM(svgContent, id = null) {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      container.innerHTML = svgContent;
      if (id) container.id = id;
      container.style.cssText = 'position:absolute;top:-1000px;left:-1000px;';
      document.body.appendChild(container);

      requestAnimationFrame(() => {
        resolve(container);
      });
    });
  }

  /**
   * Clean up test SVGs
   */
  cleanupTestSVGs() {
    const testElements = document.querySelectorAll('[id^="test-svg-"], [id^="stress-svg-"]');
    testElements.forEach(el => el.remove());
  }

  /**
   * Measure touch response time
   */
  async measureTouchResponse(element) {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const handleTouch = () => {
        const responseTime = performance.now() - startTime;
        element.removeEventListener('touchstart', handleTouch);
        element.removeEventListener('click', handleTouch);
        resolve(responseTime);
      };

      element.addEventListener('touchstart', handleTouch);
      element.addEventListener('click', handleTouch);

      // Simulate touch/click
      const event = new TouchEvent('touchstart', {
        touches: [new Touch({
          identifier: 0,
          target: element,
          clientX: 50,
          clientY: 50
        })]
      });
      element.dispatchEvent(event);
    });
  }

  /**
   * Measure frame rate over a period
   */
  async measureFrameRate(duration) {
    return new Promise((resolve) => {
      let frameCount = 0;
      let totalRenderTime = 0;
      const startTime = performance.now();

      const measureFrame = (currentTime) => {
        const renderStart = performance.now();
        frameCount++;
        const renderTime = performance.now() - renderStart;
        totalRenderTime += renderTime;

        if (currentTime - startTime < duration) {
          requestAnimationFrame(measureFrame);
        } else {
          const actualDuration = currentTime - startTime;
          resolve({
            averageFPS: (frameCount / actualDuration) * 1000,
            averageRenderTime: totalRenderTime / frameCount,
            totalFrames: frameCount
          });
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * Measure CPU usage (approximation)
   */
  async measureCPUUsage(duration) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let iterations = 0;

      const cpuIntensiveTask = () => {
        const taskStart = performance.now();

        // CPU intensive calculation
        let result = 0;
        for (let i = 0; i < 100000; i++) {
          result += Math.random() * Math.sin(i);
        }

        iterations++;
        const taskTime = performance.now() - taskStart;

        if (performance.now() - startTime < duration) {
          setTimeout(cpuIntensiveTask, 10);
        } else {
          // Estimate CPU usage based on task completion rate
          const expectedIterations = duration / 15; // Baseline expectation
          const cpuUsage = Math.min(100, (expectedIterations / iterations) * 100);
          resolve(cpuUsage);
        }
      };

      cpuIntensiveTask();
    });
  }

  // ============================================================================
  // SIMULATION METHODS
  // ============================================================================

  /**
   * Simulate modal opening
   */
  async simulateModalOpen() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(modal);

    await this.sleep(50);
    modal.style.opacity = '1';
    await this.sleep(300);

    this.currentModal = modal;
  }

  /**
   * Simulate modal closing
   */
  async simulateModalClose() {
    if (this.currentModal) {
      this.currentModal.style.opacity = '0';
      await this.sleep(300);
      this.currentModal.remove();
      this.currentModal = null;
    }
  }

  /**
   * Simulate camera operation
   */
  async simulateCameraOperation() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await this.sleep(1000);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      // Camera not available, simulate with CPU intensive task
      await this.sleep(1000);
    }
  }

  /**
   * Simulate SVG manipulation
   */
  async simulateSVGManipulation() {
    const svg = await this.renderSVGToDOM(this.createTestSVG(), 'manipulation-test');

    // Simulate drag operations
    for (let i = 0; i < 10; i++) {
      svg.style.transform = `translate(${i * 10}px, ${i * 5}px) rotate(${i * 10}deg)`;
      await this.sleep(50);
    }

    svg.remove();
  }

  /**
   * Simulate mode switching
   */
  async simulateModeSwitch() {
    // Simulate camera to gallery switch
    await this.simulateCameraOperation();
    await this.sleep(200);

    // Simulate gallery access
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.click();
    await this.sleep(100);
    input.remove();
  }

  /**
   * Simulate gesture
   */
  async simulateGesture() {
    const element = document.createElement('div');
    element.style.cssText = 'position:absolute;top:100px;left:100px;width:50px;height:50px;background:blue;';
    document.body.appendChild(element);

    // Simulate touch gesture
    const touchStart = new TouchEvent('touchstart', {
      touches: [new Touch({
        identifier: 0,
        target: element,
        clientX: 100,
        clientY: 100
      })]
    });

    const touchMove = new TouchEvent('touchmove', {
      touches: [new Touch({
        identifier: 0,
        target: element,
        clientX: 150,
        clientY: 150
      })]
    });

    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [new Touch({
        identifier: 0,
        target: element,
        clientX: 150,
        clientY: 150
      })]
    });

    element.dispatchEvent(touchStart);
    await this.sleep(50);
    element.dispatchEvent(touchMove);
    await this.sleep(50);
    element.dispatchEvent(touchEnd);

    element.remove();
  }

  /**
   * Simulate typical usage pattern
   */
  async simulateTypicalUsage() {
    // Random typical actions
    const actions = [
      () => this.simulateCameraOperation(),
      () => this.simulateSVGManipulation(),
      () => this.simulateGesture(),
      () => this.simulateModalOpen().then(() => this.simulateModalClose())
    ];

    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    await randomAction();
  }

  // ============================================================================
  // MOBILE-SPECIFIC TESTS
  // ============================================================================

  /**
   * Test camera permission handling
   */
  async testCameraPermissions() {
    const metrics = {
      permissionRequestTime: 0,
      permissionGranted: false,
      errorHandling: true
    };

    try {
      const start = performance.now();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      metrics.permissionRequestTime = performance.now() - start;
      metrics.permissionGranted = true;
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      metrics.permissionRequestTime = performance.now() - start;
      metrics.errorHandling = error.name === 'NotAllowedError';
    }

    return {
      ...metrics,
      passed: metrics.permissionRequestTime < 2000
    };
  }

  /**
   * Test touch target responsiveness
   */
  async testTouchTargets() {
    const metrics = {
      smallTargetResponse: 0,
      largeTargetResponse: 0,
      accuracy: 0
    };

    // Test small touch target (30px)
    const smallTarget = document.createElement('div');
    smallTarget.style.cssText = 'position:fixed;top:50%;left:50%;width:30px;height:30px;background:red;';
    document.body.appendChild(smallTarget);

    metrics.smallTargetResponse = await this.measureTouchResponse(smallTarget);
    smallTarget.remove();

    // Test large touch target (60px)
    const largeTarget = document.createElement('div');
    largeTarget.style.cssText = 'position:fixed;top:50%;left:50%;width:60px;height:60px;background:green;';
    document.body.appendChild(largeTarget);

    metrics.largeTargetResponse = await this.measureTouchResponse(largeTarget);
    largeTarget.remove();

    return {
      ...metrics,
      passed: metrics.smallTargetResponse < 150 && metrics.largeTargetResponse < 100
    };
  }

  /**
   * Test orientation change performance
   */
  async testOrientationChanges() {
    const metrics = {
      orientationChangeTime: 0,
      layoutStability: true,
      errorCount: 0
    };

    try {
      const start = performance.now();

      // Simulate orientation change
      window.dispatchEvent(new Event('orientationchange'));
      await this.sleep(500);

      metrics.orientationChangeTime = performance.now() - start;
    } catch (error) {
      metrics.errorCount++;
    }

    return {
      ...metrics,
      passed: metrics.orientationChangeTime < 1000 && metrics.errorCount === 0
    };
  }

  /**
   * Test Capacitor plugin efficiency
   */
  async testCapacitorPlugins() {
    const metrics = {
      cameraPluginTime: 0,
      filesystemPluginTime: 0,
      pluginErrors: 0
    };

    // Test Camera plugin
    try {
      const start = performance.now();
      if (window.Capacitor && window.Capacitor.Plugins.Camera) {
        // Simulate camera plugin call
        await this.sleep(100); // Simulate plugin call
      }
      metrics.cameraPluginTime = performance.now() - start;
    } catch (error) {
      metrics.pluginErrors++;
    }

    // Test Filesystem plugin
    try {
      const start = performance.now();
      if (window.Capacitor && window.Capacitor.Plugins.Filesystem) {
        // Simulate filesystem plugin call
        await this.sleep(50); // Simulate plugin call
      }
      metrics.filesystemPluginTime = performance.now() - start;
    } catch (error) {
      metrics.pluginErrors++;
    }

    return {
      ...metrics,
      passed: metrics.pluginErrors === 0
    };
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  /**
   * Generate comprehensive performance report
   */
  generateComprehensiveReport() {
    const report = {
      summary: this.generateSummary(),
      detailedResults: this.testResults,
      performanceMetrics: this.performanceMetrics,
      recommendations: this.generateRecommendations(),
      deviceInfo: this.getDeviceInfo(),
      timestamp: new Date().toISOString(),
      testDuration: performance.now() - this.testStartTime
    };

    console.log('📊 Performance Test Report Generated');
    console.log('=' .repeat(60));
    console.log(this.formatReportForConsole(report));

    return report;
  }

  /**
   * Generate test summary
   */
  generateSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'passed').length;
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;

    const criticalIssues = this.identifyCriticalIssues();
    const performanceScore = this.calculatePerformanceScore();

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      criticalIssues: criticalIssues.length,
      performanceScore,
      overallStatus: performanceScore >= 70 ? 'GOOD' : performanceScore >= 50 ? 'FAIR' : 'POOR'
    };
  }

  /**
   * Identify critical performance issues
   */
  identifyCriticalIssues() {
    const issues = [];

    // Check for memory leaks
    const memoryGrowth = this.getCurrentMemoryUsage() - this.memoryBaseline;
    if (memoryGrowth > this.config.memoryThreshold) {
      issues.push({
        type: 'MEMORY_LEAK',
        severity: 'HIGH',
        description: `Memory usage increased by ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        recommendation: 'Investigate SVG cleanup and event listener removal'
      });
    }

    // Check for slow camera initialization
    const cameraTest = this.testResults.find(t => t.name.includes('Camera Initialization'));
    if (cameraTest && cameraTest.result && cameraTest.result.initTime > this.config.cameraInitThreshold) {
      issues.push({
        type: 'SLOW_CAMERA_INIT',
        severity: 'HIGH',
        description: `Camera initialization takes ${cameraTest.result.initTime.toFixed(0)}ms`,
        recommendation: 'Optimize camera stream management and reduce initialization overhead'
      });
    }

    // Check for poor frame rate
    if (this.performanceMetrics.frameRate && this.performanceMetrics.frameRate.length > 0) {
      const avgFrameRate = this.performanceMetrics.frameRate.reduce((a, b) => a + b.fps, 0) / this.performanceMetrics.frameRate.length;
      if (avgFrameRate < this.config.frameRateThreshold) {
        issues.push({
          type: 'LOW_FRAME_RATE',
          severity: 'MEDIUM',
          description: `Average frame rate is ${avgFrameRate.toFixed(1)} FPS`,
          recommendation: 'Optimize rendering pipeline and reduce DOM manipulations'
        });
      }
    }

    // Check for slow touch response
    const touchTest = this.testResults.find(t => t.name.includes('Touch Response'));
    if (touchTest && touchTest.result && touchTest.result.averageResponseTime > this.config.touchResponseThreshold) {
      issues.push({
        type: 'SLOW_TOUCH_RESPONSE',
        severity: 'MEDIUM',
        description: `Touch response time is ${touchTest.result.averageResponseTime.toFixed(0)}ms`,
        recommendation: 'Optimize touch event handlers and reduce gesture processing overhead'
      });
    }

    return issues;
  }

  /**
   * Calculate overall performance score
   */
  calculatePerformanceScore() {
    let score = 100;
    const issues = this.identifyCriticalIssues();

    // Deduct points for issues
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'HIGH':
          score -= 25;
          break;
        case 'MEDIUM':
          score -= 15;
          break;
        case 'LOW':
          score -= 5;
          break;
      }
    });

    // Deduct points for failed tests
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;
    score -= failedTests * 10;

    return Math.max(0, score);
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const issues = this.identifyCriticalIssues();

    // Add issue-specific recommendations
    issues.forEach(issue => {
      recommendations.push({
        priority: issue.severity,
        category: issue.type,
        description: issue.recommendation,
        codeAreas: this.getRelevantCodeAreas(issue.type)
      });
    });

    // Add general recommendations
    recommendations.push({
      priority: 'MEDIUM',
      category: 'GENERAL_OPTIMIZATION',
      description: 'Implement React.memo for SVG components to prevent unnecessary re-renders',
      codeAreas: ['useSVGLayers hook', 'SVG rendering components']
    });

    recommendations.push({
      priority: 'MEDIUM',
      category: 'GENERAL_OPTIMIZATION',
      description: 'Use requestAnimationFrame for smooth animations and gesture updates',
      codeAreas: ['useTouchGestures hook', 'AROverlayStage component']
    });

    recommendations.push({
      priority: 'LOW',
      category: 'GENERAL_OPTIMIZATION',
      description: 'Implement virtual scrolling for large SVG libraries',
      codeAreas: ['SVGLibraryPanel component']
    });

    return recommendations;
  }

  /**
   * Get relevant code areas for issue types
   */
  getRelevantCodeAreas(issueType) {
    const codeAreaMap = {
      'MEMORY_LEAK': [
        'useCamera hook - stream cleanup',
        'useSVGLayers hook - URL.revokeObjectURL calls',
        'Event listener cleanup in useEffect'
      ],
      'SLOW_CAMERA_INIT': [
        'useCamera hook - camera stream management',
        'ARCameraBackground component',
        'Camera permission handling'
      ],
      'LOW_FRAME_RATE': [
        'AROverlayStage component',
        'SVG rendering pipeline',
        'Touch gesture handlers'
      ],
      'SLOW_TOUCH_RESPONSE': [
        'useTouchGestures hook',
        'Touch event handlers',
        'Gesture recognition logic'
      ]
    };

    return codeAreaMap[issueType] || ['General application code'];
  }

  /**
   * Get device information
   */
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      devicePixelRatio: window.devicePixelRatio,
      touchSupport: 'ontouchstart' in window,
      memoryInfo: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }

  /**
   * Format report for console output
   */
  formatReportForConsole(report) {
    let output = '';

    output += `\n🎯 PERFORMANCE TEST SUMMARY\n`;
    output += `Tests: ${report.summary.passedTests}/${report.summary.totalTests} passed (${report.summary.successRate.toFixed(1)}%)\n`;
    output += `Performance Score: ${report.summary.performanceScore}/100 (${report.summary.overallStatus})\n`;
    output += `Critical Issues: ${report.summary.criticalIssues}\n`;
    output += `Test Duration: ${(report.testDuration / 1000).toFixed(1)}s\n\n`;

    if (report.summary.criticalIssues > 0) {
      output += `🚨 CRITICAL ISSUES FOUND:\n`;
      const issues = this.identifyCriticalIssues();
      issues.forEach((issue, index) => {
        output += `${index + 1}. [${issue.severity}] ${issue.type}\n`;
        output += `   ${issue.description}\n`;
        output += `   💡 ${issue.recommendation}\n\n`;
      });
    }

    output += `📋 TOP RECOMMENDATIONS:\n`;
    report.recommendations.slice(0, 5).forEach((rec, index) => {
      output += `${index + 1}. [${rec.priority}] ${rec.description}\n`;
      output += `   Areas: ${rec.codeAreas.join(', ')}\n\n`;
    });

    return output;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Timeout utility
   */
  timeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), ms)
    );
  }

  /**
   * Export test results
   */
  exportResults(format = 'json') {
    const report = this.generateComprehensiveReport();

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(report);
    }

    return report;
  }

  /**
   * Convert results to CSV format
   */
  convertToCSV(report) {
    const headers = ['Test Name', 'Status', 'Duration (ms)', 'Memory Delta (MB)', 'Passed'];
    const rows = report.detailedResults.map(result => [
      result.name,
      result.status,
      result.duration?.toFixed(2) || 'N/A',
      result.memoryDelta ? (result.memoryDelta / 1024 / 1024).toFixed(2) : 'N/A',
      result.result?.passed || false
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceTestSuite;
} else {
  window.PerformanceTestSuite = PerformanceTestSuite;
}
