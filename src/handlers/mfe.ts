/**
 * Micro Front-End (MFE) interaction handler
 *
 * Loads a Micro Front-End component (React, Vue, Web Component) and mounts it.
 *
 * Props are collected from data-mfe-* attributes on the container element:
 *   data-mfe-title="Toldby"           → props.title = "Toldby"
 *   data-mfe-logo-src="/favicon.svg"  → props.logoSrc = "/favicon.svg"
 *
 * The context bus state is also passed as props.context so MFEs can
 * access shared state without importing md2interact directly.
 *
 * Emits 'mfe:mounted' event on the event bus.
 */

import type { CleanupFn } from '../types';
import { bus } from '../bus';
import { getAll } from '../context';
import { registerAPI } from '../fetch-proxy';
import { getInteractionName } from './shared';

/** Convert kebab-case to camelCase: "logo-src" → "logoSrc" */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Collect props from data-mfe-* attributes on the container.
 * Excludes reserved keys: data-mfe-src, data-mfe-api, data-mfe-hash, data-mfe-props.
 */
function collectProps(container: HTMLElement): Record<string, unknown> {
  const reserved = new Set(['mfeSrc', 'mfeApi', 'mfeHash', 'mfeProps']);
  const props: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(container.dataset)) {
    if (!key.startsWith('mfe') || reserved.has(key)) continue;
    // Strip "mfe" prefix and camelCase: mfeLogoSrc → logoSrc, mfeLogoHref → logoHref
    const propName = key.replace(/^mfe/, '');
    const camel = propName.charAt(0).toLowerCase() + propName.slice(1);
    props[camel] = value;
  }

  return props;
}

/** Attempt to call a mount function and return its cleanup */
function tryMount(
  fn: (container: HTMLElement, props: Record<string, unknown>) => CleanupFn | void,
  container: HTMLElement,
  props: Record<string, unknown>
): CleanupFn {
  const result = fn(container, props);
  return typeof result === 'function' ? result : () => {};
}

export interface MFEScopedOptions {
  /** Emit `mfe:mounted` on the global bus (document-level `init` only). */
  emitMounted?: boolean;
}

/**
 * Load and mount a single mfe: interaction, scoped to its container.
 *
 * Unlike startMFE, this variant does NOT touch the global fetch proxy, the
 * global context bus, or the global event bus unless explicitly asked. It is
 * safe for embedded renderers (e.g. a preview pipe) that must not clobber the
 * host application's wiring.
 */
export async function startMFEScoped(
  container: HTMLElement,
  context: Record<string, unknown>,
  options: MFEScopedOptions = {},
): Promise<CleanupFn> {
  const src = container.dataset.mfeSrc;
  if (!src) {
    console.warn('[md2interact] mfe: missing data-mfe-src');
    return () => {};
  }

  // Layer 1: props from data-mfe-* attributes
  let props = collectProps(container);

  // Layer 2: explicit JSON props (overrides attribute props)
  if (container.dataset.mfeProps) {
    try {
      const jsonProps = JSON.parse(container.dataset.mfeProps);
      props = { ...props, ...jsonProps };
    } catch {
      console.warn('[md2interact] mfe: invalid JSON in data-mfe-props');
    }
  }

  // Layer 3: context snapshot provided by the caller
  props.context = context;

  try {
    const mod = await import(/* @vite-ignore */ src);

    if (typeof mod.mount === 'function') {
      const cleanup = tryMount(mod.mount, container, props);
      if (options.emitMounted) {
        bus.emit('mfe:mounted', { name: getInteractionName(container) });
      }
      return cleanup;
    }

    if (typeof mod.default === 'function') {
      const cleanup = tryMount(mod.default, container, props);
      if (options.emitMounted) {
        bus.emit('mfe:mounted', { name: getInteractionName(container) });
      }
      return cleanup;
    }

    console.warn(`[md2interact] mfe: "${src}" does not export a mount function`);
  } catch (err) {
    console.error(`[md2interact] mfe: failed to load "${src}":`, err);
  }

  return () => {};
}

/**
 * Start an mfe interaction on the given container element (document-level).
 *
 * Also performs declarative BFF API registration from data-mfe-api /
 * data-mfe-hash attributes.
 */
export async function startMFE(container: HTMLElement): Promise<CleanupFn> {
  const apiPattern = container.dataset.mfeApi;
  const apiHash = container.dataset.mfeHash;
  if (apiPattern && apiHash) {
    registerAPI(apiPattern, apiHash);
    console.log(`[md2interact] mfe: registered API "${apiPattern}" → hash ${apiHash}`);
  }
  if (apiHash && !apiPattern) {
    registerAPI('/mfe/*', apiHash);
    console.log(`[md2interact] mfe: registered default API "/mfe/*" → hash ${apiHash}`);
  }

  return startMFEScoped(container, getAll(), { emitMounted: true });
}
