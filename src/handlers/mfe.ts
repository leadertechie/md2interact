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

/**
 * Start an mfe interaction on the given container element.
 *
 * Supports declarative API registration via HTML attributes:
 *   data-mfe-api  — URL pattern to register (e.g., "/api/search*")
 *   data-mfe-hash — FNV-1a hash of the BFF worker binding name
 *
 * Props flow:
 *   1. data-mfe-* attributes (e.g., data-mfe-title)
 *   2. data-mfe-props (JSON string, overrides attribute props)
 *   3. context: current state snapshot from the context bus
 */
export async function startMFE(container: HTMLElement): Promise<CleanupFn> {
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

  // Layer 3: context bus state snapshot
  props.context = getAll();

  // Declarative API registration from HTML attributes
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
