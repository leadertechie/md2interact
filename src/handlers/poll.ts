/**
 * Poll interaction handler
 *
 * Periodically fetch an endpoint and update target elements.
 * Supports exponential backoff on failure.
 */

import type { CleanupFn } from '../types';
import { updateBindings } from './shared';

const DEFAULT_INTERVAL = 30; // seconds
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 1000; // 1 second

/**
 * Start a poll interaction on the given container element.
 */
export function startPoll(container: HTMLElement): CleanupFn {
  const endpoint = container.dataset.pollEndpoint;
  if (!endpoint) {
    console.warn('[md2interact] poll: missing data-poll-endpoint');
    return () => {};
  }

  const intervalMs = (parseInt(container.dataset.pollInterval || String(DEFAULT_INTERVAL), 10)) * 1000;
  const url: string = endpoint; // Narrow type for closure

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let retryAttempt = 0;
  let aborted = false;

  async function fetchAndUpdate(): Promise<void> {
    if (aborted) return;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();

      retryAttempt = 0; // Reset on success
      updateBindings(container, data);
    } catch (err) {
      console.error(`[md2interact] poll fetch failed for "${endpoint}":`, err);

      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        retryAttempt++;
        const delay = BASE_RETRY_DELAY * Math.pow(2, retryAttempt - 1);
        console.warn(`[md2interact] poll retry ${retryAttempt}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);

        // Pause regular interval during backoff
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }

        setTimeout(() => {
          if (!aborted) {
            fetchAndUpdate();
            // Resume regular interval after retry
            if (intervalId === null) {
              intervalId = setInterval(fetchAndUpdate, intervalMs);
            }
          }
        }, delay);
      } else {
        console.error(`[md2interact] poll max retries reached for "${endpoint}"`);
      }
    }
  }

  // Immediate first call + start interval
  fetchAndUpdate();
  intervalId = setInterval(fetchAndUpdate, intervalMs);

  return () => {
    aborted = true;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
