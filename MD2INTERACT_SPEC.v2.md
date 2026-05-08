# md2interact v1 Specification

**Package:** `@leadertechie/md2interact`
**Version:** 0.1.0
**Status:** Draft — NEW PACKAGE
**Runtime:** Browser Web Worker (NOT Cloudflare Worker)

---

## 1. Design Philosophy

md2interact is a browser-side Web Worker that reads the DOM for known interaction patterns declared in markdown frontmatter. It handles:

1. **Interaction wiring** — scanning `data-interaction` attributes and attaching behaviors
2. **CSS hydration** — inlining critical CSS, managing `@layer` injection, theme toggling
3. **Event bus** — cross-interaction message passing

It does NOT run on the edge. It does NOT know about page layout. It is purely a client-side behavior engine.

### What md2interact is NOT:
- Not a framework (no virtual DOM, no state management)
- Not a build tool (no compilation needed)
- Not a React/MDX replacement (no JSX, no component imports)

---

## 2. Architecture

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

---

## 3. Interaction Types

### 3.1 `data-interaction="poll:NAME"`

Periodically fetch an endpoint and update target elements.

### Frontmatter (processed by toldby.pages, NOT md2interact)

```markdown
---
interactions:
  comments:
    type: poll
    endpoint: /api/comments
    interval: 30          # seconds
    target: "#comment-count"
    binding: data-bind="count"
---
```

### Output HTML

```html
<div data-interaction="poll:comments" 
     data-poll-endpoint="/api/comments" 
     data-poll-interval="30">
  <span data-bind="count">0</span> comments
</div>
```

### Worker Behavior

```typescript
function startPoll(container: HTMLElement) {
  const endpoint = container.dataset.pollEndpoint;
  const interval = parseInt(container.dataset.pollInterval || '30') * 1000;
  
  async function fetchAndUpdate() {
    const res = await fetch(endpoint);
    const data = await res.json();
    // Find all [data-bind] children and update text
    container.querySelectorAll('[data-bind]').forEach(el => {
      el.textContent = data[el.dataset.bind] ?? el.textContent;
    });
  }
  
  fetchAndUpdate();  // Immediate first call
  setInterval(fetchAndUpdate, interval);
}
```

---

### 3.2 `data-interaction="live-update:NAME"`

Real-time updates via EventSource (SSE) or WebSocket.

### Frontmatter

```markdown
---
interactions:
  counter:
    type: live-update
    endpoint: /api/stats
    protocol: sse          # or 'websocket'
---
```

### Output HTML

```html
<div data-interaction="live-update:counter"
     data-live-endpoint="/api/stats"
     data-live-protocol="sse">
  Visitors: <span data-bind="visitors">--</span>
  Online: <span data-bind="online">--</span>
</div>
```

### Worker Behavior

```typescript
function startLiveUpdate(container: HTMLElement) {
  const endpoint = container.dataset.liveEndpoint;
  const protocol = container.dataset.liveProtocol || 'sse';
  
  if (protocol === 'sse') {
    const source = new EventSource(endpoint);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      container.querySelectorAll('[data-bind]').forEach(el => {
        el.textContent = data[el.dataset.bind] ?? el.textContent;
      });
    };
  } else if (protocol === 'websocket') {
    const ws = new WebSocket(endpoint);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      container.querySelectorAll('[data-bind]').forEach(el => {
        el.textContent = data[el.dataset.bind] ?? el.textContent;
      });
    };
  }
}
```

---

### 3.3 `data-interaction="click-toggle:NAME"`

Toggle a CSS class on a target element when clicked.

### Frontmatter

```markdown
---
interactions:
  expand:
    type: click-toggle
    target: "#details-section"
    class: "expanded"
    trigger: "#expand-btn"
---
```

### Output HTML

```html
<button id="expand-btn" data-interaction="click-toggle:expand"
        data-toggle-target="#details-section"
        data-toggle-class="expanded">
  Toggle Details
</button>
<div id="details-section" class="collapsed">...</div>
```

### Worker Behavior

```typescript
function startClickToggle(container: HTMLElement) {
  const targetSelector = container.dataset.toggleTarget;
  const className = container.dataset.toggleClass || 'active';
  const target = document.querySelector(targetSelector);
  
  if (!target) return;
  
  container.addEventListener('click', () => {
    target.classList.toggle(className);
    // Emit event
    bus.emit('toggle:changed', { 
      name: container.dataset.interaction.split(':')[1],
      active: target.classList.contains(className)
    });
  });
}
```

---

### 3.4 `data-interaction="infinite-scroll:NAME"`

Load next page when user scrolls near bottom.

### Frontmatter

```markdown
---
interactions:
  feed:
    type: infinite-scroll
    endpoint: /api/posts
    pageParam: cursor
    container: "#post-feed"
    itemSelector: ".post-card"
---
```

### Output HTML

```html
<div data-interaction="infinite-scroll:feed"
     data-scroll-endpoint="/api/posts"
     data-scroll-param="cursor"
     data-scroll-container="#post-feed"
     data-scroll-item=".post-card"
     data-scroll-next=""
     data-scroll-loading="false"
     id="post-feed">
  <!-- Server-rendered initial page of posts -->
  <article class="post-card">...</article>
  <article class="post-card">...</article>
</div>
```

### Worker Behavior

```typescript
function startInfiniteScroll(container: HTMLElement) {
  const endpoint = container.dataset.scrollEndpoint;
  const param = container.dataset.scrollParam || 'cursor';
  const itemSelector = container.dataset.scrollItem || '.item';
  
  const observer = new IntersectionObserver((entries) => {
    const sentinel = container.querySelector('[data-scroll-sentinel]');
    if (entries[0].isIntersecting && sentinel && !container.dataset.scrollLoading) {
      container.dataset.scrollLoading = 'true';
      const cursor = container.dataset.scrollNext;
      fetch(`${endpoint}?${param}=${cursor}`)
        .then(r => r.json())
        .then(data => {
          data.items.forEach(item => {
            const el = document.createElement('div');
            el.innerHTML = item.html;
            sentinel.before(el.firstElementChild);
          });
          container.dataset.scrollNext = data.nextCursor || '';
          if (!data.nextCursor) sentinel.remove();
          container.dataset.scrollLoading = 'false';
        });
    }
  });
  
  const sentinel = document.createElement('div');
  sentinel.dataset.scrollSentinel = '';
  container.appendChild(sentinel);
  observer.observe(sentinel);
}
```

---

### 3.5 `data-interaction="form-live:NAME"`

Intercept form submission, send via fetch, update UI without page reload.

### Frontmatter

```markdown
---
interactions:
  comment-form:
    type: form-live
    endpoint: /api/comments
    method: POST
    target: "#comments-section"
    resetOnSuccess: true
---
```

### Output HTML

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

### Worker Behavior

```typescript
function startFormLive(form: HTMLFormElement) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const endpoint = form.dataset.formEndpoint;
    const method = form.dataset.formMethod || 'POST';
    const target = form.dataset.formTarget;
    
    const fd = new FormData(form);
    const res = await fetch(endpoint, { method, body: fd });
    const html = await res.text();
    
    if (target) {
      document.querySelector(target)?.insertAdjacentHTML('beforeend', html);
    }
    if (form.dataset.formReset) form.reset();
    
    bus.emit('form:submitted', { name: form.dataset.interaction.split(':')[1] });
  });
}
```

---

### 3.6 `data-interaction="mfe:NAME"`

Loads a Micro Front-End component (React, Vue, Web Component) and mounts it.

### Output HTML

```html
<div data-interaction="mfe:invite-form"
     data-mfe-src="/assets/mfe/invite-form.js"
     data-mfe-props='{"campaign": "beta"}'>
  <!-- Optional skeleton UI -->
  <div class="mfe-loading">Initializing form...</div>
</div>
```

### Worker Behavior

```typescript
async function startMFE(container: HTMLElement) {
  const src = container.dataset.mfeSrc;
  const props = JSON.parse(container.dataset.mfeProps || '{}');
  
  // Dynamic import of the MFE bundle
  const { mount } = await import(src);
  
  if (typeof mount === 'function') {
    mount(container, props);
    bus.emit('mfe:mounted', { name: container.dataset.interaction.split(':')[1] });
  }
}
```

---

## 4. Event Bus

### Purpose
Allows interactions to communicate. E.g., a "like" button emits `post:liked` → a counter widget hears it and updates.

### API

```typescript
interface InteractionEvent {
  type: string;          // e.g., "post:liked", "form:submitted", "toggle:changed"
  data: Record<string, unknown>;
  timestamp: number;
}

const bus = {
  on(eventType: string, handler: (event: InteractionEvent) => void): void,
  off(eventType: string, handler: (event: InteractionEvent) => void): void,
  emit(type: string, data: Record<string, unknown>): void,
  once(eventType: string, handler: (event: InteractionEvent) => void): void,
};
```

### Usage

```html
<!-- Liker -->
<button data-interaction="click-toggle:liker"
        data-toggle-class="liked"
        data-toggle-target="#post-123"
        data-emit="post:liked">❤️ Like</button>

<!-- Counter subscribes by setting data-subscribe -->
<span data-interaction="live-update:counter"
      data-subscribe="post:liked"
      data-bind="likes">0</span>
```

When the like button is clicked, the click-toggle handler toggles the class AND emits `post:liked`. The counter's `data-subscribe` picks it up and updates via its own polling.

---

## 5. CSS Hydration Engine

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
function toggleTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}
```

---

## 6. Edge Cases & Safety

| Concern | Mitigation |
|---------|-----------|
| **Worker doesn't load (old browser)** | Page works without JS. All interactions are progressive enhancement. |
| **Interaction element missing from DOM** | Worker silently skips — no error thrown. |
| **Multiple same interactions on page** | Worker deduplicates by `data-interaction` value. |
| **Fetch fails (network down)** | Worker retries with exponential backoff (poll), or auto-reconnects (SSE/WS). |
| **Memory leaks** | Worker cleans up intervals/observers when interaction element is removed from DOM (uses `MutationObserver`). |
| **Admin changes interaction config** | Worker re-scans DOM on `pageshow` or `pushState` for SPA navigations. |

---

## 7. No Changes

The following are explicitly NOT in md2interact:
- Not a Lit/Render framework — no component model, no shadow DOM
- Not a build tool — no Webpack/Vite integration
- Not a state manager — only the lightweight event bus
- Not edge-side — runs only in the browser
- Not a fetch layer — r2tohtml does that

---

## 8. Migration Path

| Step | Files | Notes |
|------|-------|-------|
| 1. Create package scaffold | `src/worker.ts`, `src/types.ts`, `package.json` | npm init |
| 2. Implement DOM scanner | `src/scanner.ts` | Reads all `[data-interaction]` |
| 3. Implement interaction handlers | `src/handlers/poll.ts`, `src/handlers/live-update.ts`, etc. | One file per type |
| 4. Implement event bus | `src/bus.ts` | pub/sub pattern |
| 5. Implement CSS hydration | `src/css-hydration.ts` | Inline critical CSS, @layer, theme |
| 6. Implement cleanup (MutationObserver) | `src/cleanup.ts` | Teardown on element removal |
| 7. Tests | `src/__tests__/*.test.ts` | DOM-based tests with JSDOM |
| 8. Bundle | Vite build → single JS file | Output to dist/ |
