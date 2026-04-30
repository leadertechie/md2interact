/**
 * Core types for md2interact
 */

/** Supported interaction types */
export type InteractionType =
  | 'poll'
  | 'live-update'
  | 'click-toggle'
  | 'infinite-scroll'
  | 'form-live'
  | 'mfe'
  | 'custom';

/** Parsed interaction identifier from data-interaction="TYPE:NAME" */
export interface InteractionId {
  type: InteractionType;
  name: string;
}

/** Event bus event structure */
export interface InteractionEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/** Event bus handler */
export type EventHandler = (event: InteractionEvent) => void;

/** Cleanup function returned by interaction starters */
export type CleanupFn = () => void;

/** Registry entry for tracking active interactions */
export interface InteractionEntry {
  id: InteractionId;
  container: HTMLElement;
  cleanup: CleanupFn | null;
}

/** CSS hydration options */
export interface CSSHydrationOptions {
  inlineCritical?: boolean;
  injectLayer?: boolean;
  themeToggle?: boolean;
}

// (RetryState removed — retry logic is now inlined in handlers)
