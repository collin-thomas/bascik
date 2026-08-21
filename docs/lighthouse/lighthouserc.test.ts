import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('Lighthouse CI configuration', () => {
  const configPath = join(process.cwd(), 'lighthouse/lighthouserc.json');

  it('contains valid Lighthouse CI configuration JSON', async () => {
    const raw = await readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    expect(config).toBeDefined();
    expect(config.ci).toBeDefined();
  });

  it('configures server collection and key documentation routes', async () => {
    const raw = await readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    const collect = config.ci.collect;
    expect(collect.startServerCommand).toBe('bascik --serve');
    expect(Array.isArray(collect.url)).toBe(true);
    expect(collect.url.length).toBeGreaterThan(0);
    expect(collect.url).toContain('http://localhost:8080/');
    expect(collect.url).toContain('http://localhost:8080/performance');
  });

  it('defines assertion score thresholds for Lighthouse categories', async () => {
    const raw = await readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    const assertions = config.ci.assert.assertions;
    expect(assertions['categories:performance']).toBeDefined();
    expect(assertions['categories:accessibility']).toBeDefined();
    expect(assertions['categories:best-practices']).toBeDefined();
    expect(assertions['categories:seo']).toBeDefined();
  });
});
