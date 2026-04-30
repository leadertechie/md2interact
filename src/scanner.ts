/**
 * DOM Scanner — reads all [data-interaction] attributes and parses them
 */

import type { InteractionId, InteractionType } from './types';

/**
 * Parse a data-interaction attribute value like "poll:comments"
 * Returns null if the format is invalid.
 */
export function parseInteractionId(value: string): InteractionId | null {
  const parts = value.split(':');
  if (parts.length < 2) return null;

  const type = parts[0] as InteractionType;
  const name = parts.slice(1).join(':');

  const validTypes: InteractionType[] = [
    'poll',
    'live-update',
    'click-toggle',
    'infinite-scroll',
    'form-live',
    'mfe',
    'custom',
  ];

  if (!validTypes.includes(type)) return null;

  return { type, name };
}

/**
 * Scan the DOM for all elements with [data-interaction] attributes.
 * Returns a map of interaction ID string → element, deduplicating by value.
 */
export function scanDOM(
  root: Document | HTMLElement = document
): Map<string, HTMLElement> {
  const elements = root.querySelectorAll<HTMLElement>('[data-interaction]');
  const found = new Map<string, HTMLElement>();

  elements.forEach((el) => {
    const raw = el.dataset.interaction;
    if (!raw) return;

    const id = parseInteractionId(raw);
    if (!id) {
      console.warn(`[md2interact] Invalid data-interaction value: "${raw}"`);
      return;
    }

    // Deduplicate by data-interaction value — first one wins
    if (!found.has(raw)) {
      found.set(raw, el);
    } else {
      console.warn(
        `[md2interact] Duplicate data-interaction="${raw}" found, skipping duplicate`
      );
    }
  });

  return found;
}

/**
 * Check if an element supports the `data-subscribe` attribute
 * and return the event types it subscribes to.
 */
export function getSubscriptions(container: HTMLElement): string[] {
  const raw = container.dataset.subscribe;
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
