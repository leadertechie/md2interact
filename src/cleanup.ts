/**
 * Cleanup module
 *
 * Uses MutationObserver to detect when interaction elements are removed from the DOM
 * and runs their cleanup functions to prevent memory leaks.
 */

import type { InteractionEntry, CleanupFn } from './types';

/**
 * Registry of active interactions with their cleanup functions.
 */
const registry = new Map<string, InteractionEntry>();

/**
 * Register an active interaction for cleanup tracking.
 */
export function registerInteraction(
  key: string,
  entry: InteractionEntry
): void {
  registry.set(key, entry);
}

/**
 * Unregister an interaction from cleanup tracking.
 */
export function unregisterInteraction(key: string): void {
  registry.delete(key);
}

/**
 * Get a registered interaction entry.
 */
export function getInteraction(key: string): InteractionEntry | undefined {
  return registry.get(key);
}

/**
 * Get all registered interactions.
 */
export function getAllInteractions(): Map<string, InteractionEntry> {
  return new Map(registry);
}

/**
 * Clean up a specific interaction by key.
 */
export function cleanupInteraction(key: string): void {
  const entry = registry.get(key);
  if (entry?.cleanup) {
    try {
      entry.cleanup();
    } catch (err) {
      console.error(`[md2interact] Error cleaning up interaction "${key}":`, err);
    }
  }
  registry.delete(key);
}

/**
 * Clean up all registered interactions.
 */
export function cleanupAll(): void {
  registry.forEach((entry, key) => {
    if (entry.cleanup) {
      try {
        entry.cleanup();
      } catch (err) {
        console.error(`[md2interact] Error cleaning up interaction "${key}":`, err);
      }
    }
  });
  registry.clear();
}

/**
 * Start a MutationObserver that watches for removed interaction elements
 * and runs their cleanup functions.
 */
export function startCleanupObserver(
  root: Document | HTMLElement = document
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const removedNode of mutation.removedNodes) {
        if (removedNode.nodeType !== Node.ELEMENT_NODE) continue;

        const el = removedNode as HTMLElement;

        // Check if the removed element itself has a data-interaction
        const raw = el.dataset.interaction;
        if (raw && registry.has(raw)) {
          cleanupInteraction(raw);
        }

        // Check if any descendants have data-interaction
        const descendants = el.querySelectorAll<HTMLElement>('[data-interaction]');
        descendants.forEach((descendant) => {
          const key = descendant.dataset.interaction;
          if (key && registry.has(key)) {
            cleanupInteraction(key);
          }
        });
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return observer;
}
