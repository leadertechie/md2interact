import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mounts: 0,
  cleanups: 0,
}));

vi.mock('../handlers/mfe', () => ({
  startMFE: vi.fn(() => {
    mocks.mounts += 1;
    let cleaned = false;
    return () => {
      if (cleaned) return;
      cleaned = true;
      mocks.cleanups += 1;
    };
  }),
}));

import { init, reinit, destroy } from '../worker';

const options = { css: { inlineCritical: false } } as const;

function addMfe(interaction = 'mfe:test'): HTMLElement {
  const el = document.createElement('div');
  el.dataset.interaction = interaction;
  el.dataset.mfeSrc = '/test.js';
  document.body.appendChild(el);
  return el;
}

describe('worker init lifecycle', () => {
  beforeEach(() => {
    mocks.mounts = 0;
    mocks.cleanups = 0;
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    delete document.documentElement.dataset.theme;

    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tears down the previous wiring when init() is called twice', async () => {
    addMfe();

    await init(options);
    expect(mocks.mounts).toBe(1);
    expect(mocks.cleanups).toBe(0);

    await init(options);
    expect(mocks.mounts).toBe(2);
    expect(mocks.cleanups).toBe(1);
    expect(mocks.mounts - mocks.cleanups).toBe(1);
  });

  it('installs the navigation listeners exactly once', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    addMfe();

    await init(options);
    await init(options);

    expect(addListener.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);
    expect(addListener.mock.calls.filter(([type]) => type === 'pageshow')).toHaveLength(1);
  });

  it('re-scans once per popstate without stacking listeners', async () => {
    addMfe();
    await init(options);

    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(mocks.mounts).toBe(2));

    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(mocks.mounts).toBe(3));

    expect(mocks.cleanups).toBe(2);
    expect(mocks.mounts - mocks.cleanups).toBe(1);
  });

  it('does not re-scan on popstate when disabled', async () => {
    addMfe();
    await init({ ...options, reinitOnPopState: false });
    expect(mocks.mounts).toBe(1);

    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(mocks.mounts).toBe(1);
    expect(mocks.cleanups).toBe(0);
  });

  it('removes the navigation listeners on destroy()', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    addMfe();
    await init(options);

    destroy();

    expect(removeListener.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);
    expect(removeListener.mock.calls.filter(([type]) => type === 'pageshow')).toHaveLength(1);
  });

  it('reinit() keeps the current options when none are passed', async () => {
    addMfe();
    await init({ ...options, reinitOnPopState: false });

    await reinit();

    expect(mocks.mounts).toBe(2);
    expect(mocks.cleanups).toBe(1);
  });
});
