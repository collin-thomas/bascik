import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderMd, renderMdRange, extractDemoBlock } from './md-renderer.js';

describe('md-renderer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-renderer-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('renderMd transforms code blocks, callouts, and external links', async () => {
    const mdContent = `## Title

Paragraph text.

\`\`\`ts
const x = 1;
\`\`\`

> **Note.** Important callout.

[External](https://example.com)
`;
    const mdFile = join(tempDir, 'test.md');
    await writeFile(mdFile, mdContent);

    const html = await renderMd(mdFile);
    expect(html).toContain('<h2 id="title"><a class="anchor-link" href="#title">Title</a></h2>');
    expect(html).toContain('<code-block data-bascik-prop-lang="ts">');
    expect(html).toContain('<div class="callout">');
    expect(html).toContain('<a target="_blank" rel="noopener noreferrer" href="https://example.com"');
  });

  it('renderMd supports skipFirstHeading option', async () => {
    const mdContent = `# Title\n\nSecond heading text.\n\n## Subheading\n\nContent.`;
    const mdFile = join(tempDir, 'skip.md');
    await writeFile(mdFile, mdContent);

    const html = await renderMd(mdFile, { skipFirstHeading: true });
    expect(html).not.toContain('<h2 id="title">');
    expect(html).toContain('<h2 id="subheading">');
  });

  it('renderMdRange renders content between headings', async () => {
    const mdContent = `
# Title

## Section 1
First content.

## Section 2
Second content.

## Section 3
Third content.
`;
    const mdFile = join(tempDir, 'range.md');
    await writeFile(mdFile, mdContent);

    const html = await renderMdRange(mdFile, { from: 'Section 2', to: 'Section 3' });
    expect(html).toContain('Second content.');
    expect(html).not.toContain('First content.');
    expect(html).not.toContain('Third content.');
  });

  it('extractDemoBlock extracts marked fenced code blocks', async () => {
    const mdContent = `
# Demo Page

<!-- demo:source-html -->
\`\`\`html
<div class="card">
  <p>Hello</p>
</div>
\`\`\`
`;
    const mdFile = join(tempDir, 'demo.md');
    await writeFile(mdFile, mdContent);

    const code = await extractDemoBlock(mdFile, 'source-html');
    expect(code).toBe('&lt;div class="card"&gt;\n  &lt;p&gt;Hello&lt;/p&gt;\n&lt;/div&gt;');
  });

  it('extractDemoBlock returns error comment if marker not found', async () => {
    const mdFile = join(tempDir, 'missing.md');
    await writeFile(mdFile, '# No marker');

    const result = await extractDemoBlock(mdFile, 'missing-marker');
    expect(result).toContain('<!-- demo:missing-marker not found');
  });
});
