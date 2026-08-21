import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateLighthouseAllConfig } from './generate-config.ts';

describe('Lighthouse CI configuration', () => {
  const configPath = join(process.cwd(), 'lighthouse/lighthouserc.json');

  it('contains valid Lighthouse CI configuration JSON', async () => {
    const raw = await readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    expect(config).toBeDefined();
    expect(config.ci).toBeDefined();
  });

  it('configures server collection and 3 core documentation routes by default', async () => {
    const raw = await readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    const collect = config.ci.collect;
    expect(collect.startServerCommand).toBe('bascik --serve');
    expect(Array.isArray(collect.url)).toBe(true);
    expect(collect.url).toEqual([
      'http://localhost:8080/',
      'http://localhost:8080/getting-started',
      'http://localhost:8080/components',
    ]);
  });

  it('generates lighthouserc.all.json dynamically from nav.ts', async () => {
    const urls = await generateLighthouseAllConfig();
    expect(urls.length).toBeGreaterThan(40);
    expect(urls).toContain('http://localhost:8080/');
    expect(urls).toContain('http://localhost:8080/getting-started');
    expect(urls).toContain('http://localhost:8080/components');
    expect(urls).toContain('http://localhost:8080/performance');

    const allConfigRaw = await readFile(join(process.cwd(), 'lighthouse/lighthouserc.all.json'), 'utf8');
    const allConfig = JSON.parse(allConfigRaw);
    expect(allConfig.ci.collect.url).toHaveLength(urls.length);
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
