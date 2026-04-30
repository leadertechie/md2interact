import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startPoll } from '../handlers/poll';
import { startClickToggle } from '../handlers/click-toggle';
import { startFormLive } from '../handlers/form-live';
import { bus } from '../bus';

describe('startPoll', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a cleanup function', () => {
    const container = document.createElement('div');
    container.dataset.pollEndpoint = '/api/test';
    container.dataset.pollInterval = '30';

    const cleanup = startPoll(container);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('warns when endpoint is missing', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    const cleanup = startPoll(container);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('missing data-poll-endpoint')
    );
    cleanup();
  });

  it('fetches and updates bindings', async () => {
    const container = document.createElement('div');
    container.dataset.pollEndpoint = '/api/comments';
    container.dataset.pollInterval = '30';
    container.innerHTML = '<span data-bind="count">0</span>';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ count: 42 }),
    });

    const cleanup = startPoll(container);

    // Wait for the immediate fetch promise to resolve
    await vi.advanceTimersByTimeAsync(0);

    const span = container.querySelector('[data-bind="count"]');
    expect(span?.textContent).toBe('42');

    cleanup();
  });
});

describe('startClickToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    bus.clear();
  });

  it('toggles class on target element', () => {
    const target = document.createElement('div');
    target.id = 'target';
    target.className = 'collapsed';
    document.body.appendChild(target);

    const btn = document.createElement('button');
    btn.dataset.interaction = 'click-toggle:expand';
    btn.dataset.toggleTarget = '#target';
    btn.dataset.toggleClass = 'expanded';
    document.body.appendChild(btn);

    const cleanup = startClickToggle(btn);

    btn.click();
    expect(target.classList.contains('expanded')).toBe(true);

    btn.click();
    expect(target.classList.contains('expanded')).toBe(false);

    cleanup();
  });

  it('emits toggle:changed event', () => {
    const handler = vi.fn();
    bus.on('toggle:changed', handler);

    const target = document.createElement('div');
    target.id = 'target2';
    document.body.appendChild(target);

    const btn = document.createElement('button');
    btn.dataset.interaction = 'click-toggle:expand';
    btn.dataset.toggleTarget = '#target2';
    document.body.appendChild(btn);

    const cleanup = startClickToggle(btn);
    btn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'toggle:changed',
        data: expect.objectContaining({ name: 'expand', active: true }),
      })
    );

    cleanup();
  });

  it('warns when target is missing', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const btn = document.createElement('button');
    const cleanup = startClickToggle(btn);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('missing data-toggle-target')
    );
    cleanup();
  });
});

describe('startFormLive', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.fetch = vi.fn();
    bus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('intercepts form submission', async () => {
    const form = document.createElement('form');
    form.dataset.formEndpoint = '/api/comments';
    form.dataset.formMethod = 'POST';
    form.innerHTML = '<input name="text" value="hello">';
    document.body.appendChild(form);

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => '<div>New comment</div>',
    });

    const cleanup = startFormLive(form);

    const submitEvent = new Event('submit', { cancelable: true });
    form.dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/comments', {
      method: 'POST',
      body: expect.any(FormData),
    });

    cleanup();
  });

  it('emits form:submitted event', async () => {
    const handler = vi.fn();
    bus.on('form:submitted', handler);

    const form = document.createElement('form');
    form.dataset.interaction = 'form-live:comment-form';
    form.dataset.formEndpoint = '/api/comments';
    document.body.appendChild(form);

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });

    const cleanup = startFormLive(form);
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Wait for async handler
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    cleanup();
  });
});
