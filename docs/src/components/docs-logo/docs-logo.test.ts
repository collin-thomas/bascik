import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('docs-logo component', () => {
  const componentPath = join(process.cwd(), 'src/components/docs-logo/docs-logo.html');

  it('renders SVG brand logo with polygon and BASCIK text', async () => {
    const html = await readFile(componentPath, 'utf8');

    expect(html).toContain('class="dlogo"');
    expect(html).toContain('viewBox="0 0 114 28"');
    expect(html).toContain('BASCIK');
  });
});
