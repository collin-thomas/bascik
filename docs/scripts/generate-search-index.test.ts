import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('generate-search-index', () => {
  it('generates dist/assets/search-index.json from nav pages', async () => {
    await import('./generate-search-index.js');

    const searchIndexFile = path.resolve(import.meta.dirname, '../dist/assets/search-index.json');
    const content = await fs.readFile(searchIndexFile, 'utf8');
    const entries = JSON.parse(content);

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);

    const firstEntry = entries[0];
    expect(firstEntry).toHaveProperty('title');
    expect(firstEntry).toHaveProperty('navLabel');
    expect(firstEntry).toHaveProperty('section');
    expect(firstEntry).toHaveProperty('path');
    expect(firstEntry).toHaveProperty('text');
  });
});
