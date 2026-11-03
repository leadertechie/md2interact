/**
 * md2interact — Browser-side Web Worker entry point
 *
 * Reads the DOM for known interaction patterns declared in markdown frontmatter
 * and wires them up. Handles interaction wiring, CSS hydration, event bus,
 * and the MFE context bus for cross-component state sharing.
 *
 * Usage:
 *   <script type="module">
 *     import { init } from 'https://cdn.example.com/md2interact.js';
 *     init();
 *   </script>
 */

import { scanDOM } from './scanner';
import { bus } from './bus';
import { initContext } from './context';
import { hydrateCSS } from './css-hydration';
import {
  registerInteraction,
  startCleanupObserver,
  cleanupAll,
} from './cleanup';
import { startPoll } from './handlers/poll';
import { startLiveUpdate } from './handlers/live-update';
import { startClickToggle } from './handlers/click-toggle';
import { startInfiniteScroll } from './handlers/infinite-scroll';
import { startFormLive } from './handlers/form-live';
import { startMFE } from './handlers/mfe';
import { startCustom } from './handlers/custom';
import { installFetchProxy, uninstallFetchProxy } from './fetch-proxy';
import type { CleanupFn, CSSHydrationOptions, InteractionType } from './types';

/** Configuration options for md2interact */
export interface Md2InteractOptions {
  css?: CSSHydrationOptions;
  root?: Document | HTMLElement;
  reinitOnPopState?: boolean;
}

/** Map interaction type to its handler function */
type HandlerFn = (el: HTMLElement) => CleanupFn | Promise<CleanupFn>;

const handlerMap: Record<string, HandlerFn> = {
  poll: startPoll,
  'live-update': startLiveUpdate,
  'click-toggle': startClickToggle,
  'infinite-scroll': startInfiniteScroll,
  'form-live': (el) => {
    if (el instanceof HTMLFormElement) return startFormLive(el);
    console.warn(`[md2interact] form-live: element is not a <form>, got ${el.tagName}`);
    return () => {};
  },
  mfe: (el) => startMFE(el),
  custom: (el) => startCustom(el),
};

// ── Module state ─────────────────────────────────────────────────
// init() is idempotent: a second call replaces the previous wiring instead
// of stacking a second copy of every interaction on the page.

let activeObserver: MutationObserver | null = null;
let navigationListenersInstalled = false;
let currentOptions: Md2InteractOptions = {};
let scanQueue: Promise<void> = Promise.resolve();

function teardownInteractions(): void {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  cleanupAll();
  bus.clear();
}

/**
 * Tear down any previous wiring, then scan the DOM and wire every
 * interaction. Listeners are managed by init()/destroy(), not here.
 */
async function scanAndWire(options: Md2InteractOptions): Promise<void> {
  const { css = {}, root = document } = options;

  teardownInteractions();

  // Seed the MFE context bus from the DOM (before MFEs mount)
  initContext();

  // Install the fetch proxy for BFF hash-based routing
  installFetchProxy();

  await hydrateCSS(css);

  const interactions = scanDOM(root as HTMLElement);
  const wirePromises: Promise<void>[] = [];

  interactions.forEach((container, key) => {
    const raw = container.dataset.interaction;
    if (!raw) return;

    const [type, ...nameParts] = raw.split(':');
    const name = nameParts.join(':');

    const handler = handlerMap[type];
    if (!handler) {
      console.warn(`[md2interact] Unknown interaction type: "${type}"`);
      return;
    }

    const result = handler(container);

    // Handle both sync and async handlers uniformly
    const cleanupPromise = Promise.resolve(result).then((cleanup) => {
      registerInteraction(key, {
        id: { type: type as InteractionType, name },
        container,
        cleanup,
      });
    });

    wirePromises.push(cleanupPromise);
  });

  // Wait for async interactions (MFE, custom) to finish
  await Promise.allSettled(wirePromises);

  // Start cleanup observer for memory leak prevention
  activeObserver = startCleanupObserver(root as HTMLElement);
}

/**
 * Queue a scan so overlapping navigation events cannot wire the same
 * interactions twice. Each scan tears down the result of the previous one.
 */
function enqueueScan(options: Md2InteractOptions): Promise<void> {
  const run = (): Promise<void> => scanAndWire(options);
  scanQueue = scanQueue.then(run, run);
  return scanQueue;
}

function rescan(): void {
  if (!currentOptions.reinitOnPopState) return;
  void enqueueScan(currentOptions);
}

function onPopState(): void {
  rescan();
}

function onPageShow(event: PageTransitionEvent): void {
  // Only restore from bfcache; a normal load already called init().
  if (event.persisted) rescan();
}

function installNavigationListeners(): void {
  if (!navigationListenersInstalled) {
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);
    navigationListenersInstalled = true;
  }
}

function removeNavigationListeners(): void {
  if (!navigationListenersInstalled) return;
  window.removeEventListener('popstate', onPopState);
  window.removeEventListener('pageshow', onPageShow);
  navigationListenersInstalled = false;
}

/**
 * Initialize md2interact: scan DOM, wire interactions, hydrate CSS,
 * and seed the MFE context bus from <script data-mfe-context>.
 *
 * Safe to call more than once: the previous wiring is cleaned up first.
 */
export async function init(options: Md2InteractOptions = {}): Promise<void> {
  const reinitOnPopState = options.reinitOnPopState ?? true;
  currentOptions = { ...options, reinitOnPopState };

  console.log('[md2interact] Initializing...');

  if (reinitOnPopState) {
    installNavigationListeners();
  } else {
    removeNavigationListeners();
  }

  await enqueueScan(currentOptions);

  console.log('[md2interact] Initialized successfully');
}

/**
 * Re-scan the DOM for new interactions (useful after dynamic content insertion).
 * Cleans up the previous wiring, then initializes again.
 */
export async function reinit(options: Md2InteractOptions = {}): Promise<void> {
  const reinitOnPopState =
    options.reinitOnPopState ?? currentOptions.reinitOnPopState ?? true;

  currentOptions = { ...currentOptions, ...options, reinitOnPopState };

  await enqueueScan(currentOptions);
}

/**
 * Destroy all interactions and clean up.
 */
export function destroy(): void {
  removeNavigationListeners();
  teardownInteractions();
  uninstallFetchProxy();
  console.log('[md2interact] Destroyed');
}

// Export the event bus for external use
export { bus };
// Export the fetch proxy for MFE API registration
export { registerAPI, uninstallFetchProxy, getRegisteredRoutes } from './fetch-proxy';
// Export the MFE context bus for shared state
export { put, get, getAll, subscribe } from './context';

// Export the scoped MFE mount for embedded renderers
export { mountMFEs } from './scoped';
export type { MountMFEsOptions } from './scoped';
