import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('docs-nav component', () => {
  const componentPath = join(process.cwd(), 'src/components/docs-nav/docs-nav.html');

  it('renders site navigation, search component, and mobile nav build script', async () => {
    const html = await readFile(componentPath, 'utf8');

    expect(html).toContain('<nav class="dnav">');
    expect(html).toContain('<docs-logo />');
    expect(html).toContain('<docs-search />');
    expect(html).toContain('scripts/nav.ts');
  });
});
