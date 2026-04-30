/**
 * Infinite Scroll interaction handler
 *
 * Load next page when user scrolls near bottom using IntersectionObserver.
 */

import type { CleanupFn } from '../types';

/**
 * Start an infinite-scroll interaction on the given container element.
 */
export function startInfiniteScroll(container: HTMLElement): CleanupFn {
  const endpoint = container.dataset.scrollEndpoint;
  const param = container.dataset.scrollParam || 'cursor';

  if (!endpoint) {
    console.warn('[md2interact] infinite-scroll: missing data-scroll-endpoint');
    return () => {};
  }

  const url: string = endpoint;
  let observer: IntersectionObserver | null = null;
  let sentinel: HTMLElement | null = null;
  let loading = false;
  let aborted = false;
  let hasMore = true; // Track if there are more pages

  async function loadMore(): Promise<void> {
    if (loading || aborted || !hasMore) return;

    const cursor = container.dataset.scrollNext;

    loading = true;
    container.dataset.scrollLoading = 'true';

    try {
      const fetchUrl = cursor
        ? `${url}?${param}=${encodeURIComponent(cursor)}`
        : url;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (aborted) return;

      // Append items before the sentinel
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: { html?: string }) => {
          if (item.html && sentinel) {
            const temp = document.createElement('div');
            temp.innerHTML = item.html;
            const child = temp.firstElementChild;
            if (child) sentinel.before(child);
          }
        });
      }

      // Update cursor or mark end
      if (data.nextCursor) {
        container.dataset.scrollNext = data.nextCursor;
      } else {
        hasMore = false;
        container.dataset.scrollNext = '';
        if (sentinel?.parentNode) sentinel.remove();
      }
    } catch (err) {
      console.error('[md2interact] infinite-scroll fetch failed:', err);
    } finally {
      loading = false;
      container.dataset.scrollLoading = 'false';
    }
  }

  // Create sentinel element for IntersectionObserver
  sentinel = document.createElement('div');
  sentinel.dataset.scrollSentinel = '';
  sentinel.style.height = '1px';
  container.appendChild(sentinel);

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    },
    { root: null, rootMargin: '200px', threshold: 0 }
  );

  observer.observe(sentinel);

  return () => {
    aborted = true;
    observer?.disconnect();
    observer = null;
    if (sentinel?.parentNode) sentinel.remove();
    sentinel = null;
  };
}
