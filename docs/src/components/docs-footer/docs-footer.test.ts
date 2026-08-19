import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('docs-footer component', () => {
  const componentPath = join(process.cwd(), 'src/components/docs-footer/docs-footer.html');

  it('renders footer sitemap build script, logo, and copyright year script', async () => {
    const html = await readFile(componentPath, 'utf8');

    expect(html).toContain('<footer class="dfooter">');
    expect(html).toContain('<docs-logo />');
    expect(html).toContain('data-bascik-build');
    expect(html).toContain('scripts/nav.ts');
  });
});
