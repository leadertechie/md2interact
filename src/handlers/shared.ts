/**
 * Shared utilities for interaction handlers
 *
 * Extracts common patterns used across multiple handlers to reduce duplication.
 */

/**
 * Update all [data-bind] children of a container with values from a data object.
 */
export function updateBindings(
  container: HTMLElement,
  data: Record<string, unknown>
): void {
  container.querySelectorAll<HTMLElement>('[data-bind]').forEach((el) => {
    const key = el.dataset.bind;
    if (key && data[key] !== undefined) {
      el.textContent = String(data[key]);
    }
  });
}

/**
 * Extract the interaction name from a data-interaction attribute value.
 * E.g., "poll:comments" → "comments"
 */
export function getInteractionName(container: HTMLElement): string {
  return container.dataset.interaction?.split(':').slice(1).join(':') || 'unknown';
}
