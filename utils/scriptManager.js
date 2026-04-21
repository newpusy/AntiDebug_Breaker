/**
 * scriptManager.js
 * Handles loading, caching, and applying anti-debug bypass scripts
 * based on hostname patterns defined in scripts.json
 */

// Cache for parsed scripts.json to avoid repeated fetches
let scriptsCache = null;

/**
 * Fetch and parse scripts.json from extension resources
 * @returns {Promise<Array>} Array of script definition objects
 */
async function loadScriptDefinitions() {
  if (scriptsCache) return scriptsCache;

  try {
    const url = chrome.runtime.getURL('scripts.json');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch scripts.json: ${response.status}`);
    }
    scriptsCache = await response.json();
    return scriptsCache;
  } catch (err) {
    console.error('[AntiDebug_Breaker] Error loading script definitions:', err);
    return [];
  }
}

/**
 * Normalize a hostname by stripping www. prefix
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

/**
 * Check if a given hostname matches a pattern (supports wildcards)
 * @param {string} hostname - The page hostname
 * @param {string} pattern - Pattern from scripts.json (e.g. "*.example.com")
 * @returns {boolean}
 */
function hostnameMatchesPattern(hostname, pattern) {
  const normalized = normalizeHostname(hostname);
  const normalizedPattern = normalizeHostname(pattern);

  if (normalizedPattern.startsWith('*.')) {
    const base = normalizedPattern.slice(2);
    return normalized === base || normalized.endsWith('.' + base);
  }

  return normalized === normalizedPattern;
}

/**
 * Find all script entries that match the given hostname
 * @param {string} hostname
 * @returns {Promise<Array>} Matching script entry objects
 */
async function getScriptsForHostname(hostname) {
  const definitions = await loadScriptDefinitions();
  return definitions.filter(entry => {
    const patterns = Array.isArray(entry.hosts) ? entry.hosts : [entry.host];
    return patterns.some(p => p && hostnameMatchesPattern(hostname, p));
  });
}

/**
 * Extract the list of patch/script names that should be applied for a hostname
 * @param {string} hostname
 * @returns {Promise<string[]>} Array of script/patch identifiers
 */
async function getPatchNamesForHostname(hostname) {
  const matches = await getScriptsForHostname(hostname);
  const names = new Set();
  matches.forEach(entry => {
    if (Array.isArray(entry.scripts)) {
      entry.scripts.forEach(s => names.add(s));
    }
    if (Array.isArray(entry.patches)) {
      entry.patches.forEach(p => names.add(p));
    }
  });
  return Array.from(names);
}

/**
 * Determine if a hostname has any known bypass scripts defined
 * @param {string} hostname
 * @returns {Promise<boolean>}
 */
async function hasKnownScripts(hostname) {
  const matches = await getScriptsForHostname(hostname);
  return matches.length > 0;
}

/**
 * Invalidate the scripts cache (useful after updates)
 */
function invalidateCache() {
  scriptsCache = null;
}

// Export for use in background.js and popup.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadScriptDefinitions,
    getScriptsForHostname,
    getPatchNamesForHostname,
    hasKnownScripts,
    hostnameMatchesPattern,
    invalidateCache
  };
}
