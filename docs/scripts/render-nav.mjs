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
    html += '<ul class="sidebar-nav">';
    for (const page of section.pages) {
      html += `<li><a href="${page.href}"${active(currentPath, page.href)}>${page.label}</a></li>`;
    }
    html += '</ul>';
  }
  html += '</aside>';
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

  const mobileSections = NAV.map(section => {
    const links = section.pages
      .map(page => `<li><a href="${page.href}"${active(currentPath, page.href)}>${page.label}</a></li>`)
      .join('');
    return `<p class="mobile-sec-heading">${section.section}</p><ul class="mobile-sec-nav">${links}</ul>`;
  }).join('');

  return `<nav class="dnav" data-docs-nav>
  <div class="dnav-inner container">
    <a href="/" class="dnav-logo">Bascik</a>
    <details class="dnav-details">
      <summary class="dnav-toggle" aria-label="Toggle navigation">
        <span class="dnav-toggle-icon"></span>
      </summary>
      <div class="dnav-links-wrapper">
        <ul class="dnav-links">
          <li><a href="/why-bascik"${isWhyBascik ? ' aria-current="page"' : ''}>Why Bascik</a></li>
          <li><a href="/getting-started"${isDocsPage ? ' aria-current="page"' : ''}>Docs</a></li>
          <li><a href="https://github.com/collin-thomas/bascik" target="_blank" rel="noopener">GitHub</a></li>
        </ul>
        <div class="mobile-only-sections">
          <hr class="mobile-sep" />
          ${mobileSections}
        </div>
      </div>
    </details>
  </div>
</nav>`;
}
