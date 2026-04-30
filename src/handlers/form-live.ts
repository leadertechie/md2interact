/**
 * Form Live interaction handler
 *
 * Intercept form submission, send via fetch, update UI without page reload.
 * Emits 'form:submitted' event on the event bus.
 */

import type { CleanupFn } from '../types';
import { bus } from '../bus';
import { getInteractionName } from './shared';

/**
 * Start a form-live interaction on the given form element.
 */
export function startFormLive(form: HTMLFormElement): CleanupFn {
  const endpoint = form.dataset.formEndpoint;
  const method = (form.dataset.formMethod || 'POST').toUpperCase();
  const target = form.dataset.formTarget;
  const resetOnSuccess = form.dataset.formReset === 'true';

  if (!endpoint) {
    console.warn('[md2interact] form-live: missing data-form-endpoint');
    return () => {};
  }

  const url: string = endpoint;

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const fd = new FormData(form);

    try {
      const res = await fetch(url, { method, body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const html = await res.text();

      // Insert response HTML into target if specified
      if (target && html) {
        const targetEl = document.querySelector(target);
        if (targetEl) {
          targetEl.insertAdjacentHTML('beforeend', html);
        } else {
          console.warn(`[md2interact] form-live: target "${target}" not found`);
        }
      }

      // Reset form if configured
      if (resetOnSuccess) form.reset();

      // Emit form:submitted event
      bus.emit('form:submitted', { name: getInteractionName(form) });
    } catch (err) {
      console.error('[md2interact] form-live submission failed:', err);
    }
  }

  form.addEventListener('submit', handleSubmit);

  return () => {
    form.removeEventListener('submit', handleSubmit);
  };
}
