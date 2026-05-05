/**
 * Fetch Proxy — intercepts fetch() calls and rewrites API URLs with BFF hash prefixes.
 *
 * When an MFE registers its API capabilities via registerAPI(), any subsequent
 * fetch() call matching the registered pattern gets its URL rewritten to
 * include the BFF hash prefix that the routing worker understands.
 *
 * MFE Flow:
 *   1. MFE's init() calls registerAPI("/api/search*", "7fa3b2c1")
 *   2. MFE code does: fetch("/api/search?query=abc")
 *   3. Fetch proxy rewrites to: fetch("/hash/7fa3b2c1/api/search?query=abc")
 *   4. Routing worker sees /hash/ prefix, looks up hash, proxies to SEARCH_WORKER
 *   5. SEARCH_WORKER receives original: /api/search?query=abc
 *
 * The MFE code is completely unaware — it just does normal fetch() calls.
 */

/** A registered API route pattern with its BFF hash */
interface BffRoute {
  /** URL pattern to match against (e.g., "/api/search*") */
  pattern: string;
  /** FNV-1a hash of the BFF worker binding name (e.g., "7fa3b2c1") */
  hash: string;
}

/** Convert a simple glob-like pattern to a RegExp */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex chars except * and ?
  let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Convert * to wildcard (match any path segment or multi-segment)
  regex = regex.replace(/\*/g, '.*');
  // Convert ? to single char wildcard
  regex = regex.replace(/\?/g, '.');
  // Anchor to start for safety
  return new RegExp(`^${regex}`);
}

/** Registered BFF routes */
const routes: BffRoute[] = [];

/** The original fetch function before monkey-patching */
let originalFetch: typeof globalThis.fetch | null = null;

/**
 * Register a URL pattern that should be proxied to a specific BFF worker.
 * Called by MFE init() functions at load time.
 *
 * @param pattern - URL path pattern, supports * wildcard (e.g., "/api/search*")
 * @param hash - FNV-1a hash of the BFF worker binding name (e.g., "7fa3b2c1")
 */
export function registerAPI(pattern: string, hash: string): void {
  // Avoid duplicates
  const existing = routes.find(r => r.pattern === pattern);
  if (existing) {
    existing.hash = hash;
    return;
  }
  routes.push({ pattern, hash });
  console.log(`[md2interact] Registered API route: "${pattern}" → hash ${hash}`);
}

/**
 * Check if a URL matches any registered route and rewrite it if so.
 * Returns the rewritten URL string, or null if no match.
 */
function tryRewrite(url: string | URL): string | null {
  const urlStr = typeof url === 'string' ? url : url.href;
  const urlObj = typeof url === 'string' ? new URL(url, window.location.origin) : url;
  const pathWithQuery = urlObj.pathname + urlObj.search;

  for (const route of routes) {
    const regex = patternToRegex(route.pattern);
    if (regex.test(pathWithQuery)) {
      const rewritten = `/hash/${route.hash}${pathWithQuery}`;
      return rewritten;
    }
  }

  return null;
}

/**
 * Install the fetch proxy by monkey-patching window.fetch.
 * All subsequent fetch() calls will be checked against registered routes.
 */
export function installFetchProxy(): void {
  if (originalFetch) return; // Already installed

  originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rewritten = tryRewrite(
      typeof input === 'string' ? input :
      input instanceof URL ? input :
      input.url
    );

    if (rewritten) {
      // Rewrite the URL — forward everything else as-is
      if (typeof input === 'string') {
        return originalFetch!(rewritten, init);
      } else if (input instanceof URL) {
        return originalFetch!(new URL(rewritten, window.location.origin), init);
      } else {
        // Request object — keep method/headers/body, change URL
        const cloned = new Request(rewritten, input);
        return originalFetch!(cloned);
      }
    }

    // No matching route — pass through to original fetch
    return originalFetch!(input, init);
  };

  console.log('[md2interact] Fetch proxy installed');
}

/**
 * Uninstall the fetch proxy and restore the original fetch.
 */
export function uninstallFetchProxy(): void {
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
  routes.length = 0;
}

/**
 * Get all currently registered API routes.
 */
export function getRegisteredRoutes(): ReadonlyArray<BffRoute> {
  return [...routes];
}
