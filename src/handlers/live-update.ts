/**
 * Live Update interaction handler
 *
 * Real-time updates via EventSource (SSE) or WebSocket.
 * Supports auto-reconnect on connection loss.
 */

import type { CleanupFn } from '../types';
import { updateBindings } from './shared';

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second

/** Shared message handler for both SSE and WebSocket */
function createMessageHandler(
  container: HTMLElement,
  onSuccess: () => void
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      updateBindings(container, data);
      onSuccess();
    } catch (err) {
      console.error('[md2interact] live-update parse error:', err);
    }
  };
}

/**
 * Start a live-update interaction on the given container element.
 */
export function startLiveUpdate(container: HTMLElement): CleanupFn {
  const endpoint = container.dataset.liveEndpoint;
  if (!endpoint) {
    console.warn('[md2interact] live-update: missing data-live-endpoint');
    return () => {};
  }

  const protocol = container.dataset.liveProtocol || 'sse';
  const url: string = endpoint;
  let reconnectAttempt = 0;
  let aborted = false;

  function scheduleReconnect(connect: () => void): void {
    if (aborted) return;
    if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[md2interact] live-update max reconnects reached for "${url}"`);
      return;
    }
    reconnectAttempt++;
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt - 1);
    console.warn(`[md2interact] live-update reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
    setTimeout(() => {
      if (!aborted) connect();
    }, delay);
  }

  const onMessage = createMessageHandler(container, () => {
    reconnectAttempt = 0; // Reset on successful message
  });

  if (protocol === 'sse') {
    let source: EventSource | null = null;

    function connectSSE(): void {
      if (aborted) return;
      source = new EventSource(url);
      source.onmessage = onMessage;
      source.onerror = () => {
        console.warn('[md2interact] live-update SSE connection error');
        source?.close();
        scheduleReconnect(connectSSE);
      };
    }

    connectSSE();

    return () => {
      aborted = true;
      source?.close();
      source = null;
    };
  }

  if (protocol === 'websocket') {
    let ws: WebSocket | null = null;

    function connectWS(): void {
      if (aborted) return;
      ws = new WebSocket(url);
      ws.onmessage = onMessage;
      ws.onclose = () => {
        if (!aborted) {
          console.warn('[md2interact] live-update WS connection closed');
          scheduleReconnect(connectWS);
        }
      };
      ws.onerror = () => {
        console.warn('[md2interact] live-update WS error');
        ws?.close();
      };
    }

    connectWS();

    return () => {
      aborted = true;
      ws?.close();
      ws = null;
    };
  }

  console.warn(`[md2interact] live-update: unknown protocol "${protocol}"`);
  return () => {};
}
