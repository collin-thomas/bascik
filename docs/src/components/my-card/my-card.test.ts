import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('my-card component', () => {
  const componentPath = join(process.cwd(), 'src/components/my-card/my-card.html');

  it('renders card with default slot and toggle active class script', async () => {
    const html = await readFile(componentPath, 'utf8');

    expect(html).toContain('class="card"');
    expect(html).toContain('data-bascik-slot');
    expect(html).toContain('classList.toggle(\'active\')');
  });
});
