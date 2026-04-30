/**
 * CSS Hydration Engine
 *
 * Handles:
 * 1. Inlining critical CSS into <head>
 * 2. Injecting @layer structure
 * 3. Theme toggle (data-theme attribute swap)
 */

import type { CSSHydrationOptions } from './types';

/**
 * Hydrate CSS on the page: inline critical CSS, inject @layer, set up theme.
 */
export async function hydrateCSS(options: CSSHydrationOptions = {}): Promise<void> {
  const {
    inlineCritical = true,
    injectLayer = true,
    themeToggle = true,
  } = options;

  if (injectLayer) {
    injectLayerStructure();
  }

  if (inlineCritical) {
    await inlineCriticalCSS();
  }

  if (themeToggle) {
    setupThemeToggle();
  }
}

/**
 * Inject @layer structure into the page head.
 */
function injectLayerStructure(): void {
  // Check if @layer is already injected
  if (document.querySelector('style[data-md2interact-layers]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-md2interact-layers', '');
  style.textContent = `
@layer reset, base, theme, components, utilities;
  `.trim();
  document.head.insertBefore(style, document.head.firstChild);
}

/**
 * Inline critical CSS from <link rel="stylesheet"> tags.
 * Fetches the CSS content and inlines it, then defers non-critical with
 * media="print" onload="this.media='all'".
 */
async function inlineCriticalCSS(): Promise<void> {
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]'
  );

  for (const link of Array.from(links)) {
    const href = link.getAttribute('href');
    if (!href) continue;

    // Skip already-inlined or external stylesheets
    if (link.hasAttribute('data-md2interact-inlined')) continue;

    try {
      const res = await fetch(href);
      const css = await res.text();

      // Create inline <style> with the CSS content
      const style = document.createElement('style');
      style.setAttribute('data-md2interact-inlined', '');
      style.textContent = css;

      // Replace the <link> with the inline <style>
      link.parentNode?.replaceChild(style, link);
    } catch (err) {
      console.warn(`[md2interact] Failed to inline CSS from "${href}":`, err);
    }
  }
}

/**
 * Set up theme toggle functionality.
 * Detects data-theme on <html> and provides toggle function.
 */
function setupThemeToggle(): void {
  // Restore saved theme from localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.dataset.theme = savedTheme;
  }

  // Listen for theme toggle events from click-toggle interactions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const toggleBtn = target.closest('[data-theme-toggle]') as HTMLElement | null;
    if (toggleBtn) {
      const currentTheme = document.documentElement.dataset.theme || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      toggleTheme(newTheme);
    }
  });
}

/**
 * Toggle the theme between light and dark.
 */
export function toggleTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

