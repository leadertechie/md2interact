/**
 * Click Toggle interaction handler
 *
 * Toggle a CSS class on a target element when clicked.
 * Emits 'toggle:changed' event on the event bus.
 */

import type { CleanupFn } from '../types';
import { bus } from '../bus';
import { getInteractionName } from './shared';

/**
 * Start a click-toggle interaction on the given container element.
 */
export function startClickToggle(container: HTMLElement): CleanupFn {
  const targetSelector = container.dataset.toggleTarget;
  const className = container.dataset.toggleClass || 'active';
  const emitEvent = container.dataset.emit;

  if (!targetSelector) {
    console.warn('[md2interact] click-toggle: missing data-toggle-target');
    return () => {};
  }

  const target = document.querySelector(targetSelector);
  if (!target) {
    console.warn(
      `[md2interact] click-toggle: target "${targetSelector}" not found in DOM`
    );
    return () => {};
  }

  const targetEl = target as Element; // Narrowed by early return above

  function handleClick(e: Event): void {
    e.stopPropagation();
    targetEl.classList.toggle(className);

    const name = getInteractionName(container);
    const active = targetEl.classList.contains(className);

    // Emit toggle:changed event
    bus.emit('toggle:changed', { name, active });

    // Emit custom event if data-emit is set
    if (emitEvent) {
      bus.emit(emitEvent, { name, active });
    }
  }

  container.addEventListener('click', handleClick);

  return () => {
    container.removeEventListener('click', handleClick);
  };
}
