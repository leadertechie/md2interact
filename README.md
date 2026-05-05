# @leadertechie/md2interact

**Browser-side Web Worker that reads the DOM for known interaction patterns declared in markdown frontmatter.**

`md2interact` is a client-side behavior engine. It scans `data-interaction` attributes in the DOM and wires up interactivity — polling, live updates, click toggles, infinite scroll, live forms, micro front-ends, and custom modules. It also handles CSS hydration (critical CSS inlining, `@layer` injection, theme toggling) and provides a lightweight event bus for cross-interaction communication.

It does NOT run on the edge. It does NOT know about page layout. It is purely a client-side behavior engine.

---

## Installation

```bash
npm install @leadertechie/md2interact
```

---

## Quick Start

### 1. Add the script to your HTML page

```html
<script type="module">
  import { init } from 'https://cdn.example.com/md2interact.js';
  init();
</script>
```

### 2. Declare interactions in your HTML

```html
<!-- Poll: auto-refresh every 30s -->
<div data-interaction="poll:comments"
     data-poll-endpoint="/api/comments"
     data-poll-interval="30">
  <span data-bind="count">0</span> comments
</div>

<!-- Click Toggle: expand/collapse -->
<button data-interaction="click-toggle:expand"
        data-toggle-target="#details-section"
        data-toggle-class="expanded">
  Toggle Details
</button>
<div id="details-section" class="collapsed">Details content...</div>

<!-- Live Form: submit without page reload -->
<form data-interaction="form-live:comment-form"
      data-form-endpoint="/api/comments"
      data-form-method="POST"
      data-form-target="#comments-section"
      data-form-reset="true">
  <input name="text" required>
  <button type="submit">Post Comment</button>
</form>
```

### 3. That's it

`md2interact` automatically scans the DOM, wires up all interactions, hydrates CSS, and sets up the event bus.

---

## Architecture

```
Browser loads HTML
  │  (page serves <script type="module"> pointing to md2interact)
  ▼
md2interact Web Worker starts
  │
  ├── Scan DOM for [data-interaction="TYPE:NAME"]
  │     │
  │     ├── TYPE = "poll"           → start setInterval(fetch(endpoint))
  │     ├── TYPE = "live-update"    → open EventSource / WebSocket
  │     ├── TYPE = "click-toggle"   → attach click handler to parent
  │     ├── TYPE = "infinite-scroll"→ attach scroll handler
  │     ├── TYPE = "form-live"      → intercept <form> submit
  │     ├── TYPE = "mfe"            → load external Micro Front-End from URL
  │     └── TYPE = "custom"         → load external module from URL
  │
  ├── Fetch Proxy (BFF API Routing)
  │     ├── MFE registers API patterns via registerAPI() or declarative HTML attrs
  │     ├── Monkey-patches window.fetch to rewrite matching URLs
  │     ├── Rewrites: /api/search → /hash/7fa3b2c1/api/search
  │     ├── Passes through auth headers, cookies, body unchanged
  │     └── Transparent to MFE code — no changes needed
  │
  ├── CSS Hydration Engine
  │     ├── Inline critical CSS into <head>
  │     ├── Inject @layer structure
  │     └── Theme toggle (data-theme attribute swap)
  │
  └── Event Bus
        ├── Interactions emit events: "post:liked", "counter:updated"
        ├── Other interactions subscribe
        └── Bidirectional (components can talk to each other)
```

### Design Patterns Used

| Pattern | File | Purpose |
|---------|------|---------|
| **Module** | `worker.ts` | Unified `init()` entry point |
| **Strategy** | `handlers/*.ts` | Pluggable interaction handlers per type |
| **Pub/Sub** | `bus.ts` | Lightweight event bus for cross-interaction messaging |
| **Observer** | `cleanup.ts` | `MutationObserver` for memory leak prevention |
| **Registry** | `cleanup.ts` | Tracks active interactions for lifecycle management |

---

## API Reference

### `init(options?)`

Initialize md2interact: scan DOM, wire interactions, hydrate CSS.

```typescript
import { init } from '@leadertechie/md2interact';

// Default initialization
await init();

// With options
await init({
  css: {
    inlineCritical: true,   // Inline <link> stylesheets into <style>
    injectLayer: true,      // Inject @layer reset, base, theme, components, utilities
    themeToggle: true,      // Enable data-theme toggle with localStorage persistence
  },
  root: document,           // Root element to scan (default: document)
  reinitOnPopState: true,   // Re-scan on popstate/pageshow for SPA navigations
});
```

#### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `css` | `CSSHydrationOptions` | `{}` | CSS hydration configuration |
| `root` | `Document \| HTMLElement` | `document` | Root element to scan for interactions |
| `reinitOnPopState` | `boolean` | `true` | Re-scan DOM on `popstate` / `pageshow` for SPA navigations |

#### `CSSHydrationOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `inlineCritical` | `boolean` | `true` | Fetch `<link rel="stylesheet">` and inline as `<style>` |
| `injectLayer` | `boolean` | `true` | Inject `@layer reset, base, theme, components, utilities` |
| `themeToggle` | `boolean` | `true` | Enable `data-theme` attribute swap + localStorage persistence |

### `reinit(options?)`

Re-scan the DOM for new interactions (useful after dynamic content insertion).

```typescript
import { reinit } from '@leadertechie/md2interact';

// After dynamically adding new interaction elements
await reinit();
```

### `destroy()`

Destroy all interactions and clean up.

```typescript
import { destroy } from '@leadertechie/md2interact';

destroy(); // Cleans up all intervals, observers, event listeners
```

### `bus`

The event bus instance for cross-interaction communication.

```typescript
import { bus } from '@leadertechie/md2interact';

// Subscribe to events
bus.on('post:liked', (event) => {
  console.log('Post liked at', event.timestamp, event.data);
});

// Emit events
bus.emit('post:liked', { postId: '123' });

// One-time subscription
bus.once('form:submitted', (event) => {
  console.log('Form submitted once:', event.data);
});

// Unsubscribe
const handler = (event) => { /* ... */ };
bus.on('counter:updated', handler);
bus.off('counter:updated', handler);

// Clear all handlers
bus.clear();
```

### `toggleTheme(theme)`

Programmatically toggle the theme.

```typescript
import { toggleTheme } from '@leadertechie/md2interact';

toggleTheme('dark');  // Sets data-theme="dark" on <html> + saves to localStorage
toggleTheme('light'); // Sets data-theme="light" on <html> + saves to localStorage
```

---

## Interaction Types

### `poll:NAME`

Periodically fetch an endpoint and update target elements. Supports exponential backoff on failure (up to 5 retries).

```html
<div data-interaction="poll:comments"
     data-poll-endpoint="/api/comments"
     data-poll-interval="30">
  <span data-bind="count">0</span> comments
</div>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-poll-endpoint` | ✅ | — | URL to fetch |
| `data-poll-interval` | ❌ | `30` | Polling interval in seconds |

### `live-update:NAME`

Real-time updates via EventSource (SSE) or WebSocket. Supports auto-reconnect with exponential backoff (up to 10 attempts).

```html
<div data-interaction="live-update:counter"
     data-live-endpoint="/api/stats"
     data-live-protocol="sse">
  Visitors: <span data-bind="visitors">--</span>
  Online: <span data-bind="online">--</span>
</div>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-live-endpoint` | ✅ | — | SSE or WebSocket endpoint URL |
| `data-live-protocol` | ❌ | `sse` | Protocol: `sse` or `websocket` |

### `click-toggle:NAME`

Toggle a CSS class on a target element when clicked. Emits `toggle:changed` event on the bus.

```html
<button data-interaction="click-toggle:expand"
        data-toggle-target="#details-section"
        data-toggle-class="expanded"
        data-emit="post:liked">
  Toggle Details
</button>
<div id="details-section" class="collapsed">...</div>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-toggle-target` | ✅ | — | CSS selector for the target element |
| `data-toggle-class` | ❌ | `active` | Class to toggle on the target |
| `data-emit` | ❌ | — | Custom event type to emit on click (e.g., `post:liked`) |

### `infinite-scroll:NAME`

Load next page when user scrolls near bottom using `IntersectionObserver`. Supports cursor-based pagination.

```html
<div data-interaction="infinite-scroll:feed"
     data-scroll-endpoint="/api/posts"
     data-scroll-param="cursor"
     data-scroll-item=".post-card"
     id="post-feed">
  <article class="post-card">...</article>
  <article class="post-card">...</article>
</div>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-scroll-endpoint` | ✅ | — | API endpoint for paginated content |
| `data-scroll-param` | ❌ | `cursor` | Query parameter name for cursor |
| `data-scroll-item` | ❌ | `.item` | CSS selector for items (used for rendering) |

**Expected API response format:**

```json
{
  "items": [{ "html": "<article class=\"post-card\">...</article>" }],
  "nextCursor": "abc123"
}
```

### `form-live:NAME`

Intercept form submission, send via `fetch`, update UI without page reload. Emits `form:submitted` event on the bus.

```html
<form data-interaction="form-live:comment-form"
      data-form-endpoint="/api/comments"
      data-form-method="POST"
      data-form-target="#comments-section"
      data-form-reset="true">
  <input name="text" required>
  <button type="submit">Post Comment</button>
</form>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-form-endpoint` | ✅ | — | URL to submit the form to |
| `data-form-method` | ❌ | `POST` | HTTP method |
| `data-form-target` | ❌ | — | CSS selector to append response HTML |
| `data-form-reset` | ❌ | — | Set to `"true"` to reset form on success |

### `mfe:NAME`

Loads a Micro Front-End component (React, Vue, Web Component) and mounts it. Emits `mfe:mounted` event on the bus.

```html
<div data-interaction="mfe:invite-form"
     data-mfe-src="/assets/mfe/invite-form.js"
     data-mfe-props='{"campaign": "beta"}'>
  <div class="mfe-loading">Initializing form...</div>
</div>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-mfe-src` | ✅ | — | URL to the MFE JavaScript bundle |
| `data-mfe-props` | ❌ | `{}` | JSON string of props to pass to the mount function |

**Expected module export:**

```typescript
// Named export
export function mount(container: HTMLElement, props: Record<string, unknown>): void;

// Or default export
export default function(container: HTMLElement, props: Record<string, unknown>): void;
```

### `custom:NAME`

Loads an external module from URL and calls its `init` function. The module can return a cleanup function.

```html
<div data-interaction="custom:my-widget"
     data-custom-src="/assets/widgets/my-widget.js">
</div>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-custom-src` | ✅ | — | URL to the custom module |

**Expected module export:**

```typescript
// Named export
export function init(container: HTMLElement): (() => void) | void;

// Or default export
export default function(container: HTMLElement): (() => void) | void;
```

---

## Fetch Proxy (BFF API Routing)

The fetch proxy enables Micro Front-Ends to route API calls through the correct Cloudflare Worker (BFF) without knowing about the routing layer.

### How it works

1. **Registration** — An MFE registers its API pattern + BFF hash via `registerAPI()` (imperative) or `data-mfe-api`/`data-mfe-hash` attributes (declarative)
2. **Interception** — `window.fetch` is monkey-patched to check all outgoing requests against registered patterns
3. **Rewriting** — Matching URLs get rewritten: `/api/search?q=foo` → `/hash/7fa3b2c1/api/search?q=foo`
4. **Routing** — The Cloudflare routing worker sees `/hash/` prefix, looks up the hash, proxies to the correct BFF worker
5. **Transparency** — The MFE code does plain `fetch("/api/search?q=foo")` — no awareness of routing

### Auth Headers

The fetch proxy passes through all request properties unchanged — including `Authorization`, `Cookie`, and any custom headers. It only rewrites the URL path. Auth headers set by the page or MFE code are preserved exactly.

```typescript
import { registerAPI, getRegisteredRoutes } from '@leadertechie/md2interact';

// Register API pattern for a BFF worker
registerAPI("/api/search*", "7fa3b2c1");

// Check registered routes
console.log(getRegisteredRoutes());
// → [{ pattern: "/api/search*", hash: "7fa3b2c1" }]
```

### Declarative Registration (HTML)

```html
<div data-interaction="mfe:search-widget"
     data-mfe-src="/assets/mfe/search.js"
     data-mfe-api="/api/search*"
     data-mfe-hash="7fa3b2c1">
</div>
```

### Exports

```typescript
export { registerAPI, uninstallFetchProxy, getRegisteredRoutes } from './fetch-proxy';
```

---

## Event Bus

### Purpose

Allows interactions to communicate. E.g., a "like" button emits `post:liked` → a counter widget hears it and updates.

### API

```typescript
interface InteractionEvent {
  type: string;                    // e.g., "post:liked", "form:submitted", "toggle:changed"
  data: Record<string, unknown>;
  timestamp: number;               // Date.now() when emitted
}

bus.on(eventType: string, handler: (event: InteractionEvent) => void): void;
bus.off(eventType: string, handler: (event: InteractionEvent) => void): void;
bus.emit(type: string, data: Record<string, unknown>): void;
bus.once(eventType: string, handler: (event: InteractionEvent) => void): void;
bus.clear(): void;
```

### Usage with `data-subscribe`

```html
<!-- Liker emits custom event -->
<button data-interaction="click-toggle:liker"
        data-toggle-class="liked"
        data-toggle-target="#post-123"
        data-emit="post:liked">❤️ Like</button>

<!-- Counter subscribes to the event -->
<span data-interaction="live-update:counter"
      data-subscribe="post:liked"
      data-bind="likes">0</span>
```

When the like button is clicked, the click-toggle handler toggles the class AND emits `post:liked`. The counter's `data-subscribe` picks it up and updates via its own polling.

---

## CSS Hydration Engine

### Inline Critical CSS

The Web Worker fetches the page's CSS from `<link rel="stylesheet">`, inlines the above-fold CSS into `<style>critical</style>`, and defers non-critical CSS with `media="print" onload="this.media='all'"`.

### @layer Injection

Ensures CSS is loaded in correct layer order per CSS_CONSTITUTION:

```html
<style>
@layer reset, base, theme, components, utilities;
</style>
```

### Theme Toggle

Detects `data-theme="light|dark"` on `<html>` and swaps CSS variables:

```typescript
toggleTheme('dark');  // Sets data-theme="dark" on <html> + saves to localStorage
toggleTheme('light'); // Sets data-theme="light" on <html> + saves to localStorage
```

Theme can also be toggled via a button with `data-theme-toggle` attribute:

```html
<button data-theme-toggle>Toggle Theme</button>
```

---

## Edge Cases & Safety

| Concern | Mitigation |
|---------|-----------|
| **Worker doesn't load (old browser)** | Page works without JS. All interactions are progressive enhancement. |
| **Interaction element missing from DOM** | Worker silently skips — no error thrown. |
| **Multiple same interactions on page** | Worker deduplicates by `data-interaction` value. |
| **Fetch fails (network down)** | Worker retries with exponential backoff (poll), or auto-reconnects (SSE/WS). |
| **Memory leaks** | Worker cleans up intervals/observers when interaction element is removed from DOM (uses `MutationObserver`). |
| **Admin changes interaction config** | Worker re-scans DOM on `pageshow` or `pushState` for SPA navigations. |

---

## Exports

```typescript
// Core
export { init, reinit, destroy } from './worker';
export { bus } from './bus';
export { toggleTheme } from './css-hydration';

// Fetch Proxy (BFF API Routing)
export { registerAPI, uninstallFetchProxy, getRegisteredRoutes } from './fetch-proxy';

// Types
export type {
  InteractionType, InteractionId, InteractionEvent,
  EventHandler, CleanupFn, InteractionEntry,
  CSSHydrationOptions, RetryState,
} from './types';
```

---

## What md2interact is NOT

- **Not a framework** — no virtual DOM, no state management
- **Not a build tool** — no compilation needed
- **Not a React/MDX replacement** — no JSX, no component imports
- **Not a Lit/Render framework** — no component model, no shadow DOM
- **Not a state manager** — only the lightweight event bus
- **Not edge-side** — runs only in the browser
- **Not a fetch layer** — `r2tohtml` does that

---

## License

MIT
