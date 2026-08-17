import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGraph } from './open-graph.js';

describe('openGraph', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'open-graph-test-'));
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty string if env vars are missing', async () => {
    delete process.env.BASCIK_SITE_URL;
    delete process.env.BASCIK_PAGE_FILE;
    delete process.env.BASCIK_PAGES_DIR;

    const result = await openGraph();
    expect(result).toBe('');
  });

  it('generates OG and Twitter tags from page title and description', async () => {
    const pageFile = join(tempDir, 'about.html');
    await writeFile(
      pageFile,
      `<!DOCTYPE html>
<html>
<head>
  <title>About Bascik &amp; Features</title>
  <meta name="description" content="Learn all about Bascik static site generator." />
</head>
<body></body>
</html>`,
    );

    process.env.BASCIK_PAGE_FILE = pageFile;
    process.env.BASCIK_PAGES_DIR = tempDir;
    process.env.BASCIK_SITE_URL = 'https://bascik.dev';

    const result = await openGraph();
    expect(result).toContain('<meta property="og:type" content="website" />');
    expect(result).toContain('<meta property="og:site_name" content="Bascik" />');
    expect(result).toContain('<meta property="og:url" content="https://bascik.dev/about" />');
    expect(result).toContain('<meta property="og:title" content="About Bascik &amp;amp; Features" />');
    expect(result).toContain('<meta property="og:description" content="Learn all about Bascik static site generator." />');
    expect(result).toContain('<meta name="twitter:card" content="summary" />');
    expect(result).toContain('<meta name="twitter:title" content="About Bascik &amp;amp; Features" />');
  });

  it('extracts description correctly when single quotes are used in meta tag', async () => {
    const pageFile = join(tempDir, 'topic.html');
    await writeFile(
      pageFile,
      `<!DOCTYPE html>
<html>
<head>
  <title>Single Quote Test</title>
  <meta name='description' content='Single quoted description content' />
</head>
<body></body>
</html>`,
    );

    process.env.BASCIK_PAGE_FILE = pageFile;
    process.env.BASCIK_PAGES_DIR = tempDir;
    process.env.BASCIK_SITE_URL = 'https://bascik.dev';

    const result = await openGraph();
    expect(result).toContain('<meta property="og:description" content="Single quoted description content" />');
  });
});
