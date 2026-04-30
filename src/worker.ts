/**
 * md2interact — Browser-side Web Worker entry point
 *
 * Reads the DOM for known interaction patterns declared in markdown frontmatter
 * and wires them up. Handles interaction wiring, CSS hydration, and event bus.
 *
 * Usage:
 *   <script type="module">
 *     import { init } from 'https://cdn.example.com/md2interact.js';
 *     init();
 *   </script>
 */

import { scanDOM } from './scanner';
import { bus } from './bus';
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

/**
 * Initialize md2interact: scan DOM, wire interactions, hydrate CSS.
 */
export async function init(options: Md2InteractOptions = {}): Promise<void> {
  const {
    css = {},
    root = document,
    reinitOnPopState = true,
  } = options;

  console.log('[md2interact] Initializing...');

  // 1. Hydrate CSS
  await hydrateCSS(css);

  // 2. Scan DOM for interactions
  const interactions = scanDOM(root as HTMLElement);

  // 3. Wire each interaction
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

  // 4. Start cleanup observer for memory leak prevention
  const observer = startCleanupObserver(root as HTMLElement);

  // 5. Handle SPA navigation re-scan
  if (reinitOnPopState) {
    const reinitHandler = (): void => {
      observer.disconnect();
      cleanupAll();
      init(options);
    };

    window.addEventListener('popstate', reinitHandler);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) reinitHandler();
    });
  }

  console.log('[md2interact] Initialized successfully');
}

/**
 * Re-scan the DOM for new interactions (useful after dynamic content insertion).
 * Alias for init() — cleans up first then re-initializes.
 */
export async function reinit(options: Md2InteractOptions = {}): Promise<void> {
  cleanupAll();
  bus.clear();
  await init(options);
}

/**
 * Destroy all interactions and clean up.
 */
export function destroy(): void {
  cleanupAll();
  bus.clear();
  console.log('[md2interact] Destroyed');
}

// Export the event bus for external use
export { bus };
