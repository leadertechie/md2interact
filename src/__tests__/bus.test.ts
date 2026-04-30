import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../bus';

describe('EventBus', () => {
  beforeEach(() => {
    bus.clear();
  });

  it('emits and receives events', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', { value: 42 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'test:event',
        data: { value: 42 },
      })
    );
  });

  it('includes timestamp in events', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', {});

    const event = handler.mock.calls[0][0];
    expect(event.timestamp).toBeTypeOf('number');
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('supports multiple handlers for same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('test:event', handler1);
    bus.on('test:event', handler2);
    bus.emit('test:event', {});

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('supports unsubscribing', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.off('test:event', handler);
    bus.emit('test:event', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports once handlers', () => {
    const handler = vi.fn();
    bus.once('test:event', handler);
    bus.emit('test:event', {});
    bus.emit('test:event', {});

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handlers for different event types', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('other:event', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('handles errors in handlers gracefully', () => {
    const throwingHandler = vi.fn(() => {
      throw new Error('Handler error');
    });
    const normalHandler = vi.fn();

    bus.on('test:event', throwingHandler);
    bus.on('test:event', normalHandler);

    expect(() => bus.emit('test:event', {})).not.toThrow();
    expect(normalHandler).toHaveBeenCalledTimes(1);
  });

  it('clears all handlers', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.clear();
    bus.emit('test:event', {});

    expect(handler).not.toHaveBeenCalled();
  });
});
