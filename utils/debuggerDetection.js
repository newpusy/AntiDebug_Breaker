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
        // Look for suspiciously long regex literals often used in obfuscated code.
        // Lowered threshold from 20 to 15 — was missing some shorter obfuscation patterns
        // I kept running into on a few sites I was testing.
        return /\/[\^\$\.\*\+\?\(\)\[\]\{\}\|\\]{15,}\//i.test(src);
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
        return false
