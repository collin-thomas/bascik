import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('generate-llms-txt', () => {
  it('concatenates markdown docs into src/pages/llms.txt', async () => {
    await import('./generate-llms-txt.js');

    const llmsFile = path.resolve(import.meta.dirname, '../src/pages/llms.txt');
    const content = await fs.readFile(llmsFile, 'utf8');

    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('Bascik');
  });
});
