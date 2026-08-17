import { describe, it, expect } from 'vitest';
import { NAV } from './nav.js';

describe('NAV structure', () => {
  it('contains non-empty sections and pages', () => {
    expect(NAV.length).toBeGreaterThan(0);
    for (const section of NAV) {
      expect(section.section).toBeTruthy();
      expect(section.pages.length).toBeGreaterThan(0);
      for (const page of section.pages) {
        expect(page.label).toBeTruthy();
        expect(page.href).toMatch(/^\//);
      }
    }
  });

  it('has unique hrefs across all sections', () => {
    const hrefs = NAV.flatMap(s => s.pages.map(p => p.href));
    const uniqueHrefs = new Set(hrefs);
    expect(uniqueHrefs.size).toEqual(hrefs.length);
  });
});
