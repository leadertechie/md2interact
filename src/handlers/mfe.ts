/**
 * Micro Front-End (MFE) interaction handler
 *
 * Loads a Micro Front-End component (React, Vue, Web Component) and mounts it.
 * Emits 'mfe:mounted' event on the event bus.
 * Supports cleanup via mount function return value.
 */

import type { CleanupFn } from '../types';
import { bus } from '../bus';
import { getInteractionName } from './shared';

/** Attempt to call a mount function and return its cleanup */
function tryMount(
  fn: (container: HTMLElement, props: Record<string, unknown>) => CleanupFn | void,
  container: HTMLElement,
  props: Record<string, unknown>
): CleanupFn {
  const result = fn(container, props);
  return typeof result === 'function' ? result : () => {};
}

/**
 * Start an mfe interaction on the given container element.
 */
export async function startMFE(container: HTMLElement): Promise<CleanupFn> {
  const src = container.dataset.mfeSrc;
  if (!src) {
    console.warn('[md2interact] mfe: missing data-mfe-src');
    return () => {};
  }

  let props: Record<string, unknown> = {};
  try {
    props = JSON.parse(container.dataset.mfeProps || '{}');
  } catch {
    console.warn('[md2interact] mfe: invalid JSON in data-mfe-props');
  }

  try {
    const mod = await import(/* @vite-ignore */ src);
    const name = getInteractionName(container);

    if (typeof mod.mount === 'function') {
      const cleanup = tryMount(mod.mount, container, props);
      bus.emit('mfe:mounted', { name });
      return cleanup;
    }

    if (typeof mod.default === 'function') {
      const cleanup = tryMount(mod.default, container, props);
      bus.emit('mfe:mounted', { name });
      return cleanup;
    }

    console.warn(`[md2interact] mfe: "${src}" does not export a mount function`);
  } catch (err) {
    console.error(`[md2interact] mfe: failed to load "${src}":`, err);
  }

  return () => {};
}
