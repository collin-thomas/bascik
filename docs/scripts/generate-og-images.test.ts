import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateOgImages, renderOgSvg } from './generate-og-images.js';

describe('generate-og-images', () => {
  it('renders valid SVG markup with renderOgSvg', () => {
    const svg = renderOgSvg('Getting Started with Bascik', 'Overview', 'Learn how to install and build HTML components.');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain('OVERVIEW');
    expect(svg).toContain('Getting Started');
    expect(svg).toContain('with Bascik');
    expect(svg).toContain('Learn how to install and build');
    expect(svg).toContain('bascik.dev');
  });

  it('generates dist/assets/og/*.svg files for all pages', async () => {
    await generateOgImages();

    const ogDir = path.resolve(import.meta.dirname, '../dist/assets/og');
    const homeSvg = await fs.readFile(path.join(ogDir, 'home.svg'), 'utf8');
    expect(homeSvg).toContain('<svg');
    expect(homeSvg).toContain('Bascik');

    const gettingStartedSvg = await fs.readFile(path.join(ogDir, 'getting-started.svg'), 'utf8');
    expect(gettingStartedSvg).toContain('<svg');
    expect(gettingStartedSvg).toContain('Getting Started');

    const markdownSvg = await fs.readFile(path.join(ogDir, 'recipes-markdown.svg'), 'utf8');
    expect(markdownSvg).toContain('<svg');
    expect(markdownSvg).toContain('RECIPES');
  });
});
