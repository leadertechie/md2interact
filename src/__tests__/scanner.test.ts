import { describe, it, expect, beforeEach } from 'vitest';
import { parseInteractionId, scanDOM, getSubscriptions } from '../scanner';

describe('parseInteractionId', () => {
  it('parses valid poll interaction', () => {
    const result = parseInteractionId('poll:comments');
    expect(result).toEqual({ type: 'poll', name: 'comments' });
  });

  it('parses valid live-update interaction', () => {
    const result = parseInteractionId('live-update:counter');
    expect(result).toEqual({ type: 'live-update', name: 'counter' });
  });

  it('parses valid click-toggle interaction', () => {
    const result = parseInteractionId('click-toggle:expand');
    expect(result).toEqual({ type: 'click-toggle', name: 'expand' });
  });

  it('parses valid infinite-scroll interaction', () => {
    const result = parseInteractionId('infinite-scroll:feed');
    expect(result).toEqual({ type: 'infinite-scroll', name: 'feed' });
  });

  it('parses valid form-live interaction', () => {
    const result = parseInteractionId('form-live:comment-form');
    expect(result).toEqual({ type: 'form-live', name: 'comment-form' });
  });

  it('parses valid mfe interaction', () => {
    const result = parseInteractionId('mfe:invite-form');
    expect(result).toEqual({ type: 'mfe', name: 'invite-form' });
  });

  it('parses valid custom interaction', () => {
    const result = parseInteractionId('custom:my-widget');
    expect(result).toEqual({ type: 'custom', name: 'my-widget' });
  });

  it('returns null for invalid type', () => {
    const result = parseInteractionId('invalid:test');
    expect(result).toBeNull();
  });

  it('returns null for missing name', () => {
    const result = parseInteractionId('poll');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseInteractionId('');
    expect(result).toBeNull();
  });
});

describe('scanDOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds all data-interaction elements', () => {
    document.body.innerHTML = `
      <div data-interaction="poll:comments" id="poll1"></div>
      <div data-interaction="click-toggle:expand" id="toggle1"></div>
      <form data-interaction="form-live:form1" id="form1"></form>
    `;

    const result = scanDOM();
    expect(result.size).toBe(3);
    expect(result.has('poll:comments')).toBe(true);
    expect(result.has('click-toggle:expand')).toBe(true);
    expect(result.has('form-live:form1')).toBe(true);
  });

  it('deduplicates by data-interaction value', () => {
    document.body.innerHTML = `
      <div data-interaction="poll:comments" id="first"></div>
      <div data-interaction="poll:comments" id="second"></div>
    `;

    const result = scanDOM();
    expect(result.size).toBe(1);
    expect(result.get('poll:comments')?.id).toBe('first');
  });

  it('skips elements with invalid data-interaction', () => {
    document.body.innerHTML = `
      <div data-interaction="invalid:test"></div>
      <div data-interaction="poll:valid"></div>
    `;

    const result = scanDOM();
    expect(result.size).toBe(1);
    expect(result.has('poll:valid')).toBe(true);
  });

  it('returns empty map when no interactions exist', () => {
    document.body.innerHTML = `<div>No interactions here</div>`;
    const result = scanDOM();
    expect(result.size).toBe(0);
  });
});

describe('getSubscriptions', () => {
  it('returns empty array when no data-subscribe', () => {
    const el = document.createElement('div');
    expect(getSubscriptions(el)).toEqual([]);
  });

  it('parses single subscription', () => {
    const el = document.createElement('div');
    el.dataset.subscribe = 'post:liked';
    expect(getSubscriptions(el)).toEqual(['post:liked']);
  });

  it('parses multiple comma-separated subscriptions', () => {
    const el = document.createElement('div');
    el.dataset.subscribe = 'post:liked, form:submitted';
    expect(getSubscriptions(el)).toEqual(['post:liked', 'form:submitted']);
  });

  it('handles empty subscription string', () => {
    const el = document.createElement('div');
    el.dataset.subscribe = '';
    expect(getSubscriptions(el)).toEqual([]);
  });
});
