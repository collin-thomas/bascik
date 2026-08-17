import { describe, it, expect } from 'vitest';
import { renderPagination } from './render-nav.js';
import { NAV } from './nav.js';

describe('renderPagination', () => {
  it('returns empty string for invalid or unlisted paths', () => {
    expect(renderPagination('/non-existent-path')).toBe('');
  });

  it('renders pagination with next link for first page in NAV', () => {
    const firstPage = NAV[0].pages[0];
    const secondPage = NAV[0].pages[1];

    const html = renderPagination(firstPage.href);
    expect(html).toContain('<nav class="docs-pagination"');
    expect(html).not.toContain('data-pg="prev"');
    expect(html).toContain(`data-pg="next"`);
    expect(html).toContain(secondPage.href);
    expect(html).toContain(secondPage.label);
  });

  it('renders pagination with prev and next links for middle page', () => {
    const page = NAV[0].pages[1];
    const prevPage = NAV[0].pages[0];
    const nextPage = NAV[0].pages[2];

    const html = renderPagination(page.href);
    expect(html).toContain(`href="${prevPage.href}" data-pg="prev"`);
    expect(html).toContain(`href="${nextPage.href}" data-pg="next"`);
  });

  it('renders pagination with prev link only for last page in NAV', () => {
    const lastSection = NAV[NAV.length - 1];
    const lastPage = lastSection.pages[lastSection.pages.length - 1];
    const flat = NAV.flatMap(s => s.pages);
    const prevPage = flat[flat.length - 2];

    const html = renderPagination(lastPage.href);
    expect(html).toContain(`href="${prevPage.href}" data-pg="prev"`);
    expect(html).not.toContain('data-pg="next"');
  });
});
