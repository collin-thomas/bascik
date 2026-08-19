import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('docs-search component template', () => {
  const componentPath = join(process.cwd(), 'src/components/docs-search/docs-search.html');

  it('renders search button, modal dialog, and build script for search logic and DOM', async () => {
    const html = await readFile(componentPath, 'utf8');

    expect(html).toContain('class="dnav-search-btn"');
    expect(html).toContain('id="docs-search-input"');
    expect(html).toContain('search-logic.ts');
    expect(html).toContain('docs-search-dom.js');
  });
});
