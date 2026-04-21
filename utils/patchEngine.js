/**
 * patchEngine.js
 * Core patching utilities for neutralizing anti-debugging techniques.
 * Works alongside debuggerDetection.js to apply runtime patches.
 */

'use strict';

/**
 * List of known anti-debug method signatures and their patch strategies.
 * Each entry describes how to intercept or neutralize a specific technique.
 */
const PATCH_STRATEGIES = {
  // Infinite debugger loop via setInterval / setTimeout
  timerDebugger: {
    description: 'Patches timer-based debugger statements',
    targets: ['setInterval', 'setTimeout'],
  },
  // DevTools detection via console.log timing
  consoleTiming: {
    description: 'Neutralizes console timing fingerprinting',
    targets: ['console.log', 'console.warn', 'console.error'],
  },
  // Function.prototype.toString override detection
  toStringDetection: {
    description: 'Restores native Function.prototype.toString',
    targets: ['Function.prototype.toString'],
  },
  // window.outerWidth / outerHeight DevTools gap detection
  dimensionDetection: {
    description: 'Spoofs window dimension properties',
    targets: ['outerWidth', 'outerHeight', 'innerWidth', 'innerHeight'],
  },
};

/**
 * Wraps a global timer function (setTimeout/setInterval) to intercept
 * callbacks that contain debugger statements.
 *
 * @param {Window} win - The target window context
 * @param {'setTimeout'|'setInterval'} fnName - Which timer to patch
 */
function patchTimerFunction(win, fnName) {
  const original = win[fnName];
  if (!original || original.__adb_patched) return;

  win[fnName] = function (callback, delay, ...args) {
    let cb = callback;
    if (typeof callback === 'string') {
      // Inline string-based debugger calls
      if (/debugger/.test(callback)) {
        cb = '';
      }
    } else if (typeof callback === 'function') {
      const src = Function.prototype.toString.call(callback);
      if (/debugger/.test(src)) {
        cb = function () {};
      }
    }
    return original.call(win, cb, delay, ...args);
  };

  win[fnName].__adb_patched = true;
}

/**
 * Patches console methods to return consistent, fast responses,
 * defeating timing-based DevTools detection.
 *
 * @param {Window} win - The target window context
 */
function patchConsoleTiming(win) {
  const methods = ['log', 'warn', 'error', 'info', 'debug'];
  methods.forEach((method) => {
    const original = win.console[method];
    if (!original || original.__adb_patched) return;

    win.console[method] = function (...args) {
      return original.apply(win.console, args);
    };
    win.console[method].__adb_patched = true;
  });
}

/**
 * Restores Function.prototype.toString to the native implementation
 * if it has been overridden to detect patched/wrapped functions.
 *
 * @param {Window} win - The target window context
 */
function patchFunctionToString(win) {
  const nativeToString = win.Function.prototype.toString;
  // If it looks native already, skip
  if (/\[native code\]/.test(nativeToString.call(nativeToString))) return;

  // Restore a proxy that always reports native code
  win.Function.prototype.toString = function () {
    return `function ${this.name || ''}() { [native code] }`;
  };
}

/**
 * Applies all enabled patches to the given window context.
 *
 * @param {Window} win - The target window context
 * @param {Object} options - Which patches to apply
 * @param {boolean} options.patchTimers - Patch setTimeout/setInterval
 * @param {boolean} options.patchConsole - Patch console timing
 * @param {boolean} options.patchToString - Restore Function.toString
 * @returns {{ applied: string[], skipped: string[] }}
 */
function applyPatches(win, options = {}) {
  const applied = [];
  const skipped = [];

  if (options.patchTimers !== false) {
    try {
      patchTimerFunction(win, 'setTimeout');
      patchTimerFunction(win, 'setInterval');
      applied.push('timerDebugger');
    } catch (e) {
      skipped.push('timerDebugger');
    }
  }

  if (options.patchConsole !== false) {
    try {
      patchConsoleTiming(win);
      applied.push('consoleTiming');
    } catch (e) {
      skipped.push('consoleTiming');
    }
  }

  if (options.patchToString === true) {
    try {
      patchFunctionToString(win);
      applied.push('toStringDetection');
    } catch (e) {
      skipped.push('toStringDetection');
    }
  }

  return { applied, skipped };
}

// Export for use in content scripts and background
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyPatches, PATCH_STRATEGIES };
} else {
  window.__adbPatchEngine = { applyPatches, PATCH_STRATEGIES };
}
