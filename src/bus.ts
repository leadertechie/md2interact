/**
 * Event Bus — cross-interaction message passing
 *
 * Allows interactions to communicate. E.g., a "like" button emits `post:liked`
 * → a counter widget hears it and updates.
 */

import type { InteractionEvent, EventHandler } from './types';

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private onceHandlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event type
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from an event type
   */
  off(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
    this.onceHandlers.get(eventType)?.delete(handler);
  }

  /**
   * Emit an event to all subscribers
   */
  emit(type: string, data: Record<string, unknown>): void {
    const event: InteractionEvent = {
      type,
      data,
      timestamp: Date.now(),
    };

    // Fire regular handlers
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[md2interact] Error in event handler for "${type}":`, err);
      }
    });

    // Fire once handlers and clean them up
    const onceSet = this.onceHandlers.get(type);
    if (onceSet) {
      onceSet.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          console.error(`[md2interact] Error in once handler for "${type}":`, err);
        }
      });
      this.onceHandlers.delete(type);
    }
  }

  /**
   * Subscribe to an event type for a single emission
   */
  once(eventType: string, handler: EventHandler): void {
    if (!this.onceHandlers.has(eventType)) {
      this.onceHandlers.set(eventType, new Set());
    }
    this.onceHandlers.get(eventType)!.add(handler);
  }

  /**
   * Remove all handlers (useful for cleanup)
   */
  clear(): void {
    this.handlers.clear();
    this.onceHandlers.clear();
  }
}

/** Singleton event bus instance */
export const bus = new EventBus();
