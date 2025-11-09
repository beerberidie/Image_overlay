/**
 * Performance Test Runner for Laser Sign Visualizer
 * 
 * Integrates with the existing app to run performance tests
 * and generate actionable reports for optimization
 */

class PerformanceTestRunner {
  constructor(app) {
    this.app = app;
    this.testSuite = null;
    this.isRunning = false;
    this.results = null;
    
    this.initializeTestSuite();
  }

  /**
   * Initialize the performance test suite
   */
  async initializeTestSuite() {
    // Import the test suite
    if (typeof PerformanceTestSuite === 'undefined') {
      await this.loadTestSuite();
    }
    
    this.testSuite = new PerformanceTestSuite();
  }

  /**
   * Load the test suite dynamically
   */
  async loadTestSuite() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/tests/performance/PerformanceTestSuite.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Run performance tests with app integration
   */
  async runPerformanceTests() {
    if (this.isRunning) {
      console.warn('Performance tests are already running');
      return;
    }

    console.log('🚀 Starting Performance Tests for Laser Sign Visualizer');
    this.isRunning = true;

    try {
      // Initialize test environment
      await this.setupTestEnvironment();

      // Run the comprehensive test suite
      this.results = await this.testSuite.runFullTestSuite();

      // Generate and display results
      this.displayResults();

      // Log to app's logging system if available
      if (this.app.logger) {
        this.app.logger.logPerformance('performance_test_completed', 
          this.results.testDuration, 
          { 
            score: this.results.summary.performanceScore,
            issues: this.results.summary.criticalIssues 
          }
        );
      }

      return this.results;
    } catch (error) {
      console.error('Performance test failed:', error);
      if (this.app.logger) {
        this.app.logger.logError(error, 'performance_test_runner');
      }
      throw error;
    } finally {
      this.isRunning = false;
      await this.cleanupTestEnvironment();
    }
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    // Ensure app is in a clean state
    if (this.app.camera && this.app.camera.useCamera) {
      this.app.camera.setUseCamera(false);
    }

    // Clear any existing SVG layers
    if (this.app.svgLayers && this.app.svgLayers.layers.length > 0) {
      this.app.svgLayers.setLayers([]);
    }

    // Close any open modals
    if (this.app.setShowSettings) this.app.setShowSettings(false);
    if (this.app.setShowSVGLibrary) this.app.setShowSVGLibrary(false);
    if (this.app.setShowProjectManagement) this.app.setShowProjectManagement(false);

    // Wait for cleanup
    await this.sleep(1000);
  }

  /**
   * Cleanup test environment
   */
  async cleanupTestEnvironment() {
    // Remove any test elements
    const testElements = document.querySelectorAll('[id^="test-"], [id^="stress-"], [id^="perf-"]');
    testElements.forEach(el => el.remove());

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Display test results in a user-friendly format
   */
  displayResults() {
    if (!this.results) return;

    // Create results modal
    this.createResultsModal();
  }

  /**
   * Create and display results modal
   */
  createResultsModal() {
    const modal = document.createElement('div');
    modal.id = 'performance-results-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #1f2937;
      border-radius: 12px;
      padding: 24px;
      max-width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    content.innerHTML = this.generateResultsHTML();

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Generate HTML for results display
   */
  generateResultsHTML() {
    const { summary, recommendations } = this.results;
    const issues = this.testSuite.identifyCriticalIssues();

    let html = `
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px 0; color: #10b981;">📊 Performance Test Results</h2>
        <div style="font-size: 14px; color: #9ca3af;">
          ${new Date().toLocaleString()}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="background: #374151; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${summary.performanceScore >= 70 ? '#10b981' : summary.performanceScore >= 50 ? '#f59e0b' : '#ef4444'};">
            ${summary.performanceScore}/100
          </div>
          <div style="font-size: 12px; color: #9ca3af;">Performance Score</div>
        </div>
        
        <div style="background: #374151; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${summary.passedTests === summary.totalTests ? '#10b981' : '#ef4444'};">
            ${summary.passedTests}/${summary.totalTests}
          </div>
          <div style="font-size: 12px; color: #9ca3af;">Tests Passed</div>
        </div>
        
        <div style="background: #374151; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${summary.criticalIssues === 0 ? '#10b981' : '#ef4444'};">
            ${summary.criticalIssues}
          </div>
          <div style="font-size: 12px; color: #9ca3af;">Critical Issues</div>
        </div>
      </div>
    `;

    if (issues.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #ef4444;">🚨 Critical Issues</h3>
          <div style="space-y: 8px;">
      `;

      issues.forEach(issue => {
        const severityColor = issue.severity === 'HIGH' ? '#ef4444' : issue.severity === 'MEDIUM' ? '#f59e0b' : '#6b7280';
        html += `
          <div style="background: #374151; padding: 12px; border-radius: 6px; border-left: 4px solid ${severityColor};">
            <div style="font-weight: bold; margin-bottom: 4px;">[${issue.severity}] ${issue.type.replace(/_/g, ' ')}</div>
            <div style="font-size: 14px; color: #d1d5db; margin-bottom: 8px;">${issue.description}</div>
            <div style="font-size: 12px; color: #9ca3af;">💡 ${issue.recommendation}</div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; color: #10b981;">📋 Optimization Recommendations</h3>
        <div style="space-y: 8px;">
    `;

    recommendations.slice(0, 5).forEach((rec, index) => {
      const priorityColor = rec.priority === 'HIGH' ? '#ef4444' : rec.priority === 'MEDIUM' ? '#f59e0b' : '#6b7280';
      html += `
        <div style="background: #374151; padding: 12px; border-radius: 6px;">
          <div style="display: flex; align-items: center; margin-bottom: 4px;">
            <span style="background: ${priorityColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 8px;">
              ${rec.priority}
            </span>
            <span style="font-weight: bold;">${rec.description}</span>
          </div>
          <div style="font-size: 12px; color: #9ca3af;">
            Code areas: ${rec.codeAreas.join(', ')}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: center;">
        <button onclick="this.closest('#performance-results-modal').remove()" 
                style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          Close
        </button>
        <button onclick="window.performanceTestRunner.exportResults()" 
                style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          Export Results
        </button>
        <button onclick="window.performanceTestRunner.runPerformanceTests()" 
                style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          Run Again
        </button>
      </div>
    `;

    return html;
  }

  /**
   * Export test results
   */
  exportResults(format = 'json') {
    if (!this.results) {
      console.warn('No test results to export');
      return;
    }

    const data = this.testSuite.exportResults(format);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `laser-sign-visualizer-performance-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get quick performance snapshot
   */
  getPerformanceSnapshot() {
    return {
      memory: this.testSuite ? this.testSuite.getCurrentMemoryUsage() : 0,
      timestamp: Date.now(),
      frameRate: this.testSuite && this.testSuite.performanceMetrics.frameRate ? 
        this.testSuite.performanceMetrics.frameRate.slice(-1)[0]?.fps : 0
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Make available globally
window.PerformanceTestRunner = PerformanceTestRunner;
