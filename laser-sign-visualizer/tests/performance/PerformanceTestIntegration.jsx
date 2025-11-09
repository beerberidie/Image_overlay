/**
 * Performance Test Integration Component
 * 
 * Adds performance testing capabilities to the Laser Sign Visualizer
 * Integrates with the existing settings panel and logging system
 */

import React, { useState, useEffect, useCallback } from 'react';

const PerformanceTestIntegration = ({ 
  isOpen, 
  onClose, 
  logger, 
  camera, 
  svgLayers, 
  isMobile = false 
}) => {
  const [testRunner, setTestRunner] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState('');
  const [performanceSnapshot, setPerformanceSnapshot] = useState(null);

  // Initialize test runner
  useEffect(() => {
    if (isOpen && !testRunner) {
      initializeTestRunner();
    }
  }, [isOpen]);

  // Update performance snapshot periodically
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        updatePerformanceSnapshot();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isOpen, testRunner]);

  const initializeTestRunner = async () => {
    try {
      // Load test runner if not already loaded
      if (!window.PerformanceTestRunner) {
        await loadTestRunner();
      }

      const runner = new window.PerformanceTestRunner({
        camera,
        svgLayers,
        logger,
        setShowSettings: () => {},
        setShowSVGLibrary: () => {},
        setShowProjectManagement: () => {}
      });

      setTestRunner(runner);
      window.performanceTestRunner = runner; // Make globally available
    } catch (error) {
      console.error('Failed to initialize test runner:', error);
      if (logger) {
        logger.logError(error, 'performance_test_integration');
      }
    }
  };

  const loadTestRunner = () => {
    return new Promise((resolve, reject) => {
      // Load PerformanceTestSuite first
      const testSuiteScript = document.createElement('script');
      testSuiteScript.src = '/tests/performance/PerformanceTestSuite.js';
      testSuiteScript.onload = () => {
        // Then load TestRunner
        const testRunnerScript = document.createElement('script');
        testRunnerScript.src = '/tests/performance/TestRunner.js';
        testRunnerScript.onload = resolve;
        testRunnerScript.onerror = reject;
        document.head.appendChild(testRunnerScript);
      };
      testSuiteScript.onerror = reject;
      document.head.appendChild(testSuiteScript);
    });
  };

  const updatePerformanceSnapshot = () => {
    if (testRunner) {
      const snapshot = testRunner.getPerformanceSnapshot();
      setPerformanceSnapshot(snapshot);
    }
  };

  const runPerformanceTests = async () => {
    if (!testRunner || isRunning) return;

    setIsRunning(true);
    setProgress(0);
    setCurrentTest('Initializing...');
    setResults(null);

    try {
      // Mock progress updates (since we can't easily track real progress)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 95));
      }, 1000);

      const testResults = await testRunner.runPerformanceTests();
      
      clearInterval(progressInterval);
      setProgress(100);
      setCurrentTest('Complete');
      setResults(testResults);

      if (logger) {
        logger.logPerformance('performance_test_suite_completed', 
          testResults.testDuration, 
          {
            score: testResults.summary.performanceScore,
            criticalIssues: testResults.summary.criticalIssues,
            passedTests: testResults.summary.passedTests,
            totalTests: testResults.summary.totalTests
          }
        );
      }
    } catch (error) {
      console.error('Performance test failed:', error);
      setCurrentTest('Failed');
      if (logger) {
        logger.logError(error, 'performance_test_execution');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const exportResults = (format = 'json') => {
    if (testRunner && results) {
      testRunner.exportResults(format);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm">
        <div className="absolute inset-4 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700 bg-slate-800/50">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  📊 Performance Testing Suite
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Comprehensive performance analysis for Samsung Galaxy S20+
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Performance Snapshot */}
              {performanceSnapshot && (
                <div className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">📈 Current Performance</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {(performanceSnapshot.memory / 1024 / 1024).toFixed(1)}MB
                      </div>
                      <div className="text-xs text-slate-400">Memory Usage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {performanceSnapshot.frameRate || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400">Frame Rate (FPS)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {new Date(performanceSnapshot.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-slate-400">Last Updated</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Controls */}
              <div className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-3">🚀 Test Controls</h3>
                
                {!isRunning ? (
                  <button
                    onClick={runPerformanceTests}
                    disabled={!testRunner}
                    className="w-full p-4 rounded-xl border-2 border-emerald-600 bg-emerald-700/50 text-white hover:border-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h1m4 0h1M9 6h6" />
                      </svg>
                      <div>
                        <div className="font-semibold">Run Performance Tests</div>
                        <div className="text-sm opacity-75">
                          Comprehensive analysis (~3-5 minutes)
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center text-white">
                      <div className="text-lg font-semibold mb-2">Running Tests...</div>
                      <div className="text-sm text-slate-400">{currentTest}</div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div 
                        className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-center text-sm text-slate-400">
                      {progress}% Complete
                    </div>
                  </div>
                )}

                {!testRunner && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-900/20 border border-amber-500/50">
                    <div className="text-amber-400 text-sm">
                      ⚠️ Test runner is initializing... Please wait.
                    </div>
                  </div>
                )}
              </div>

              {/* Test Results */}
              {results && (
                <div className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">📊 Test Results</h3>
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-slate-700 text-center">
                      <div className={`text-2xl font-bold ${
                        results.summary.performanceScore >= 70 ? 'text-emerald-400' : 
                        results.summary.performanceScore >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {results.summary.performanceScore}/100
                      </div>
                      <div className="text-xs text-slate-400">Performance Score</div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-slate-700 text-center">
                      <div className={`text-2xl font-bold ${
                        results.summary.passedTests === results.summary.totalTests ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {results.summary.passedTests}/{results.summary.totalTests}
                      </div>
                      <div className="text-xs text-slate-400">Tests Passed</div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-slate-700 text-center">
                      <div className={`text-2xl font-bold ${
                        results.summary.criticalIssues === 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {results.summary.criticalIssues}
                      </div>
                      <div className="text-xs text-slate-400">Critical Issues</div>
                    </div>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => exportResults('json')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-all"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => exportResults('csv')}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm font-medium transition-all"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => testRunner.displayResults()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-all"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              {/* Test Information */}
              <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-3">ℹ️ Test Information</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <div>• <strong>Camera Performance:</strong> Initialization time, stream stability, permission handling</div>
                  <div>• <strong>SVG Rendering:</strong> Single/multiple SVG performance, memory usage per SVG</div>
                  <div>• <strong>Touch Response:</strong> Gesture recognition latency, touch target responsiveness</div>
                  <div>• <strong>Memory Analysis:</strong> Usage patterns, leak detection, garbage collection effectiveness</div>
                  <div>• <strong>UI Transitions:</strong> Modal/panel switching performance, frame rate monitoring</div>
                  <div>• <strong>Stress Testing:</strong> Maximum SVG load, rapid mode switching, extended usage</div>
                  <div>• <strong>Mobile Optimization:</strong> Samsung Galaxy S20+ specific tests, Capacitor plugin efficiency</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTestIntegration;
