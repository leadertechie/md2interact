/**
 * MFE Context Bus — shared reactive state for all micro-frontends.
 *
 * Every MFE can put(key, value) and any other MFE can get(key) or
 * subscribe(callback) to react to state changes.  Think of it as a
 * lightweight document-level store.
 *
 * The initial state is seeded from a <script data-mfe-context> block
 * injected by the view composer into the composed MD.
 *
 * Usage from any MFE:
 *   import { put, get, subscribe } from "@leadertechie/md2interact";
 *   put("theme", "dark");
 *   const theme = get("theme");
 *   subscribe((state) => { console.log(state.theme); });
 */

export interface MfeState {
  [key: string]: unknown;
}

export type StateCallback = (state: Readonly<MfeState>) => void;

/** Singleton state and listeners */
let state: MfeState = {};
const listeners = new Set<StateCallback>();

/**
 * Read initial state from <script type="application/json" data-mfe-context>
 * injected by the composer.  Returns parsed object, or empty {} on failure.
 */
function readInitialState(): MfeState {
  try {
    const el = document.querySelector<HTMLScriptElement>(
      'script[type="application/json"][data-mfe-context]'
    );
    if (el?.textContent) {
      const parsed = JSON.parse(el.textContent);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as MfeState;
      }
    }
  } catch {
    // No context block or invalid JSON — start empty
  }
  return {};
}

/**
 * Initialize the context bus. Called once by md2interact init().
 * Seeds state from the DOM context block and exposes the API on window.
 */
export function initContext(): void {
  state = readInitialState();

  // Expose on window for non-module MFEs
  (window as any).__MFE_CONTEXT__ = {
    get: (key: string) => state[key],
    getAll: () => ({ ...state }),
    put: (key: string, value: unknown) => put(key, value),
    subscribe: (cb: StateCallback) => subscribe(cb),
  };
}

/** Write a value.  No-op if unchanged.  Notifies all subscribers. */
export function put(key: string, value: unknown): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  const snapshot = Object.freeze({ ...state });
  for (const cb of listeners) {
    try { cb(snapshot); } catch { /* swallow */ }
  }
}

/** Read a single value by key. */
export function get(key: string): unknown {
  return state[key];
}

/** Get a shallow copy of all state. */
export function getAll(): MfeState {
  return { ...state };
}

/**
 * Subscribe to state changes.
 * Callback is called immediately with current state, then on every put().
 * Returns an unsubscribe function.
 */
export function subscribe(callback: StateCallback): () => void {
  listeners.add(callback);
  // Immediately call with current state snapshot
  try { callback(Object.freeze({ ...state })); } catch { /* swallow */ }
  return () => { listeners.delete(callback); };
}
