/**
 * Scoped MFE mounting for embedded renderers.
 *
 * `init()` is document-level: it hydrates the host page CSS, seeds a global
 * context bus, and monkey-patches window.fetch. That is correct for a served
 * page but wrong for an embedder (e.g. a preview pipe inside an admin SPA),
 * which must render a page fragment without clobbering the host.
 *
 * `mountMFEs` is the scoped alternative: it scans only the given root and
 * mounts its `mfe:*` interactions, returning a cleanup. It never touches the
 * fetch proxy, context bus, CSS hydration, or document head.
 */

import { scanDOM } from './scanner';
import { startMFEScoped } from './handlers/mfe';
import type { CleanupFn } from './types';

export interface MountMFEsOptions {
  /** Root element to scan for `data-interaction="mfe:*"` containers. */
  root: HTMLElement;
  /** Context snapshot passed to every mounted MFE as `props.context`. */
  context?: Record<string, unknown>;
}

/**
 * Mount every `mfe:*` interaction inside `root` and return a single cleanup
 * that unmounts all of them.
 */
export async function mountMFEs(options: MountMFEsOptions): Promise<CleanupFn> {
  const { root, context = {} } = options;
  const interactions = scanDOM(root);
  const cleanups: CleanupFn[] = [];

  for (const container of interactions.values()) {
    const raw = container.dataset.interaction;
    if (!raw || !raw.startsWith('mfe:')) continue;
    cleanups.push(await startMFEScoped(container, context));
  }

  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        // Swallow cleanup errors so one bad unmount doesn't break the rest.
      }
    }
  };
}
