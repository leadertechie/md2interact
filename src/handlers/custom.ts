/**
 * Custom interaction handler
 *
 * Loads an external module from URL and calls its init function.
 * The module should export an `init` function that receives the container element
 * and may return a cleanup function.
 */

import type { CleanupFn } from '../types';

/** Attempt to call an init function and return its cleanup */
function tryInit(
  fn: (container: HTMLElement) => CleanupFn | void,
  container: HTMLElement
): CleanupFn {
  const result = fn(container);
  return typeof result === 'function' ? result : () => {};
}

/**
 * Start a custom interaction on the given container element.
 */
export async function startCustom(container: HTMLElement): Promise<CleanupFn> {
  const src = container.dataset.customSrc;
  if (!src) {
    console.warn('[md2interact] custom: missing data-custom-src');
    return () => {};
  }

  try {
    const mod = await import(/* @vite-ignore */ src);

    if (typeof mod.init === 'function') {
      return tryInit(mod.init, container);
    }

    if (typeof mod.default === 'function') {
      return tryInit(mod.default, container);
    }

    console.warn(`[md2interact] custom: "${src}" does not export an init function`);
  } catch (err) {
    console.error(`[md2interact] custom: failed to load "${src}":`, err);
  }

  return () => {};
}
