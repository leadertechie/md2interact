import { describe, it, expect, beforeEach, vi } from 'vitest';
import { put, get, getAll, subscribe, initContext } from '../context';

describe('Context Bus', () => {
  beforeEach(() => {
    // Reset internal state (re-init clears everything)
    initContext();
  });

  describe('put / get', () => {
    it('stores and retrieves a value', () => {
      put('theme', 'dark');
      expect(get('theme')).toBe('dark');
    });

    it('returns undefined for unknown keys', () => {
      expect(get('nonexistent')).toBeUndefined();
    });

    it('does not notify subscribers when value is unchanged', () => {
      const cb = vi.fn();
      subscribe(cb);
      cb.mockClear(); // initial call doesn't count

      put('a', 1);
      expect(cb).toHaveBeenCalledTimes(1);
      put('a', 1); // same value
      expect(cb).toHaveBeenCalledTimes(1); // no additional call
    });

    it('overwrites existing keys', () => {
      put('x', 1);
      put('x', 2);
      expect(get('x')).toBe(2);
    });
  });

  describe('getAll', () => {
    it('returns a shallow copy of all state', () => {
      put('a', 1);
      put('b', 2);
      const all = getAll();
      expect(all).toEqual({ a: 1, b: 2 });
      // Mutation safety
      all.a = 99;
      expect(get('a')).toBe(1);
    });
  });

  describe('subscribe', () => {
    it('calls callback immediately with current state', () => {
      put('existing', 'value');
      const cb = vi.fn();
      subscribe(cb);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ existing: 'value' })
      );
    });

    it('calls callback on every put', () => {
      const cb = vi.fn();
      subscribe(cb);
      cb.mockClear();

      put('a', 1);
      put('b', 2);
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('returns an unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = subscribe(cb);
      cb.mockClear();

      unsub();
      put('a', 1);
      expect(cb).not.toHaveBeenCalled();
    });

    it('handles multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      subscribe(cb1);
      subscribe(cb2);
      cb1.mockClear();
      cb2.mockClear();

      put('theme', 'dark');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('handles subscriber errors gracefully', () => {
      const throwing = vi.fn(() => { throw new Error('boom'); });
      const normal = vi.fn();
      subscribe(throwing);
      subscribe(normal);
      normal.mockClear();

      expect(() => put('x', 1)).not.toThrow();
      expect(normal).toHaveBeenCalledTimes(1);
    });
  });

  describe('window.__MFE_CONTEXT__', () => {
    it('is exposed on window after initContext', () => {
      initContext();
      put('theme', 'dark');
      const ctx = (window as any).__MFE_CONTEXT__;
      expect(ctx).toBeDefined();
      expect(ctx.get('theme')).toBe('dark');
    });

    it('put via window notifies module subscribers', () => {
      const cb = vi.fn();
      subscribe(cb);
      cb.mockClear();

      (window as any).__MFE_CONTEXT__.put('fromWindow', true);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ fromWindow: true })
      );
    });
  });
});
