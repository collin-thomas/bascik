/**
 * render-nav.mjs — Build-time HTML generators for docs navigation.
 *
 * Import from a `<script data-bascik-build>` block:
 *
 *   <script data-bascik-build>
 *     import { join } from 'node:path';
 *     import { pathToFileURL } from 'node:url';
 *     const { renderNav } = await import(
 *       pathToFileURL(join(process.cwd(), 'scripts/render-nav.mjs')).href
 *     );
 *     console.log(renderNav('/getting-started'));
 *   </script>
 *
 * Exports:
 *   renderNav(currentPath)        — top nav bar with mobile drawer
 *   renderSidebar(currentPath)    — desktop sidebar with section links
 *   renderPagination(currentPath) — prev/next page links
 *
 * All three derive their page order from nav.mjs (the single source of truth).
 * To add or reorder pages, edit nav.mjs only.
 */

import { NAV } from './nav.mjs';

/** Returns aria-current="page" attribute string when href matches currentPath. */
function active(currentPath, href) {
  return currentPath === href ? ' aria-current="page"' : '';
}

/** Renders a list of <li> nav links, optionally stamping aria-current. */
function renderLinks(pages, currentPath = '') {
  return pages
    .map(p => `<li><a href="${p.href}"${active(currentPath, p.href)}>${p.label}</a></li>`)
    .join('');
}

/** Shared parallelogram badge logo — used in both nav and footer */
const LOGO_SVG = `<svg class="bascik-logo" viewBox="0 0 114 28" height="26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><polygon points="7,0 114,0 107,28 0,28" fill="#d3ff8d"/><rect x="18" y="8" width="2" height="12" rx="1" fill="#0e0f10"><animate attributeName="opacity" values="0.9;0.9;0;0" keyTimes="0;0.49;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect><text x="25" y="20" font-family="'Courier New',Courier,monospace" font-size="17" font-weight="800" fill="#0e0f10" letter-spacing="2">BASCIK</text></svg>`;

/**
 * Renders the sticky desktop sidebar `<aside>` with all section headings and
 * page links. Stamps aria-current="page" on the link matching currentPath.
 *
 * @param {string} currentPath - e.g. '/getting-started'
 */
export function renderSidebar(currentPath) {
  let html = '<aside class="docs-sidebar">';
  for (const section of NAV) {
    html += `<p class="sidebar-heading">${section.section}</p>`;
    html += `<ul class="sidebar-nav">${renderLinks(section.pages, currentPath)}</ul>`;
  }
  html += '</aside>';
  // Scroll the active sidebar link into view on load (handles long nav lists)
  html += `<script>(function(){var a=document.querySelector('.docs-sidebar [aria-current="page"]');if(a)a.scrollIntoView({block:'nearest'});})();</script>`;
  return html;
}

/**
 * Renders the prev/next pagination `<nav>` for a given page. Returns an
 * empty string when currentPath is not found in NAV or is the only page.
 *
 * @param {string} currentPath - e.g. '/slots'
 */
export function renderPagination(currentPath) {
  const flat = NAV.flatMap(s => s.pages);
  const idx = flat.findIndex(p => p.href === currentPath);
  if (idx === -1) return '';
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;
  if (!prev && !next) return '';
  let html = '<nav class="docs-pagination" aria-label="Page navigation">';
  if (prev) {
    html += `<a href="${prev.href}" data-pg="prev">`;
    html += `<span data-pg-dir>&#8592; Previous</span>`;
    html += `<span data-pg-label>${prev.label}</span>`;
    html += `</a>`;
  }
  if (next) {
    html += `<a href="${next.href}" data-pg="next">`;
    html += `<span data-pg-dir>Next &#8594;</span>`;
    html += `<span data-pg-label>${next.label}</span>`;
    html += `</a>`;
  }
  html += '</nav>';
  return html;
}

/**
 * Renders the sticky top nav bar, including the mobile hamburger drawer.
 * Stamps aria-current="page" on the correct top-level link and on the
 * matching mobile sidebar link for the current page.
 *
 * Pass an empty string or omit currentPath for non-docs pages (home, 404).
 *
 * @param {string} [currentPath] - e.g. '/slots', '/', ''
 */
export function renderNav(currentPath = '') {
  const isWhyBascik = currentPath === '/why-bascik';
  const isDocsPage = currentPath !== '' && currentPath !== '/' && currentPath !== '/why-bascik';

  const mobileSections = NAV.map(section =>
    `<p class="mobile-sec-heading">${section.section}</p><ul class="mobile-sec-nav">${renderLinks(section.pages, currentPath)}</ul>`
  ).join('');

  return `<input type="checkbox" id="dnav-toggle" class="dnav-checkbox">
<nav class="dnav" data-docs-nav>
  <div class="dnav-inner container">
    <a href="/" class="dnav-logo" aria-label="Bascik home">${LOGO_SVG}</a>
    <label for="dnav-toggle" class="dnav-toggle" tabindex="0" aria-label="Toggle navigation">
      <span class="dnav-toggle-icon"></span>
    </label>
    <div class="dnav-links-wrapper">
      <ul class="dnav-links">
        <li><a href="/why-bascik"${isWhyBascik ? ' aria-current="page"' : ''}>Why Bascik</a></li>
        <li><a href="/getting-started"${isDocsPage ? ' aria-current="page"' : ''}>Docs</a></li>
        <li><a href="https://github.com/collin-thomas/bascik" target="_blank" rel="noopener">GitHub</a></li>
      </ul>
      <div class="mobile-only-sections">
        <hr class="mobile-sep" />
        ${mobileSections}
        <hr class="mobile-sep" />
        <ul class="mobile-sec-nav">
          <li><a href="https://github.com/collin-thomas/bascik" target="_blank" rel="noopener">GitHub &nearr;</a></li>
        </ul>
      </div>
    </div>
  </div>
</nav>`;
}

/**
 * Renders the complete site footer with sitemap derived from NAV.
 * Uses global CSS classes (defined in styles.css) — not component-scoped.
 */
export function renderFooter() {
  const year = new Date().getFullYear();
  const sections = NAV.filter(s => s.section !== 'Developers');
  let sitemap = '<div class="dfooter-sitemap">';
  for (const section of sections) {
    sitemap += `<div class="dfooter-col"><p class="dfooter-col-heading">${section.section}</p><ul class="dfooter-col-links">`;
    for (const page of section.pages) {
      sitemap += `<li><a href="${page.href}">${page.label}</a></li>`;
    }
    sitemap += '</ul></div>';
  }
  sitemap += '</div>';

  return `<footer class="dfooter">
  <div class="dfooter-container">
    <div class="dfooter-upper">
      <div class="dfooter-brand">
        <a href="/" class="dfooter-logo" aria-label="Bascik home">${LOGO_SVG}</a>
        <p class="dfooter-desc">A static site generator<br>for HTML components.</p>
      </div>
      ${sitemap}
    </div>
    <div class="dfooter-bottom">
      <span class="dfooter-copy">&copy; ${year} <a href="https://rinsesoft.com" target="_blank" rel="noopener noreferrer">Rinsesoft</a>. Open source under AGPL-3.0.</span>
      <div class="dfooter-links">
        <a href="https://rinsesoft.com" target="_blank" rel="noopener noreferrer">rinsesoft.com</a>
        <a href="https://github.com/collin-thomas/bascik" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://github.com/collin-thomas/bascik/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">License</a>
      </div>
    </div>
  </div>
</footer>`;
}
