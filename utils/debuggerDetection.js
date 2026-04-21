/**
 * debuggerDetection.js
 * Utility functions for detecting and neutralizing common anti-debugging techniques.
 * Used by content.js to identify which patterns are active on a page.
 */

'use strict';

/**
 * Known anti-debug technique signatures.
 * Each entry describes a pattern, how to detect it, and a short label.
 */
const ANTI_DEBUG_PATTERNS = [
  {
    id: 'debugger_statement',
    label: 'Debugger Statement Loop',
    description: 'Repeated `debugger` statements inside setInterval or recursive functions.',
    // Heuristic: check if a setInterval with a very short delay calls debugger
    detect: () => {
      try {
        const src = document.documentElement.innerHTML;
        return /setInterval\s*\([^)]*debugger/i.test(src) ||
               /function[^{]*\{[^}]*debugger[^}]*\}/i.test(src);
      } catch (e) {
        return false;
      }
    }
  },
  {
    id: 'devtools_size_check',
    label: 'DevTools Size Check',
    description: 'Detects DevTools by comparing window.outerWidth/outerHeight to innerWidth/innerHeight.',
    detect: () => {
      try {
        const src = document.documentElement.innerHTML;
        return /outerWidth\s*-\s*innerWidth/i.test(src) ||
               /outerHeight\s*-\s*innerHeight/i.test(src);
      } catch (e) {
        return false;
      }
    }
  },
  {
    id: 'console_timing',
    label: 'Console Timing Attack',
    description: 'Measures time taken by console.log to detect if DevTools is open.',
    detect: () => {
      try {
        const src = document.documentElement.innerHTML;
        return /console\.log/.test(src) &&
               /Date\.now\(\)|performance\.now\(\)/.test(src) &&
               /devtools|debug/i.test(src);
      } catch (e) {
        return false;
      }
    }
  },
  {
    id: 'toString_override',
    label: 'Function.toString Override',
    description: 'Overrides Function.prototype.toString to detect native function inspection.',
    detect: () => {
      try {
        const src = document.documentElement.innerHTML;
        return /Function\.prototype\.toString/i.test(src);
      } catch (e) {
        return false;
      }
    }
  },
  {
    id: 'regex_deobfuscation_trap',
    label: 'Regex Deobfuscation Trap',
    description: 'Uses regex patterns that are slow under debugger inspection.',
    detect: () => {
      try {
        const src = document.documentElement.innerHTML;
        // Look for suspiciously long regex literals often used in obfuscated code
        return /\/[\^\$\.\*\+\?\(\)\[\]\{\}\|\\]{20,}\//i.test(src);
      } catch (e) {
        return false;
      }
    }
  },
  {
    id: 'infinite_loop_on_pause',
    label: 'Infinite Loop on Pause',
    description: 'Triggers an infinite loop when execution is paused in DevTools.',
    detect: () => {
      try {
        const src = document.documentElement.innerHTML;
        return /while\s*\(\s*true\s*\)/.test(src) &&
               /debugger|devtools/i.test(src);
      } catch (e) {
        return false;
      }
    }
  }
];

/**
 * Runs all detection heuristics and returns an array of matched pattern IDs.
 * @returns {string[]} Array of matched pattern IDs
 */
function detectActivePatterns() {
  const matched = [];
  for (const pattern of ANTI_DEBUG_PATTERNS) {
    try {
      if (pattern.detect()) {
        matched.push(pattern.id);
      }
    } catch (e) {
      // Silently skip patterns that throw
    }
  }
  return matched;
}

/**
 * Returns metadata for a given pattern ID.
 * @param {string} id
 * @returns {object|null}
 */
function getPatternMeta(id) {
  return ANTI_DEBUG_PATTERNS.find(p => p.id === id) || null;
}

/**
 * Returns all known pattern metadata (for display in popup).
 * @returns {object[]}
 */
function getAllPatterns() {
  return ANTI_DEBUG_PATTERNS.map(({ id, label, description }) => ({ id, label, description }));
}

// Export for use in content.js / background.js via chrome extension messaging
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectActivePatterns, getPatternMeta, getAllPatterns };
}
