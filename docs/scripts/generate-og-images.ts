#!/usr/bin/env node
/**
 * generate-og-images.ts
 *
 * Generates 1200x630 SVG Open Graph social cards for all docs pages directly into
 * docs/dist/assets/og/[slug].svg.
 *
 * It reads page structure from nav.ts, extracts metadata from content Markdown
 * files (or src/pages/*.html fallback), and builds clean vector cards.
 *
 * Run via:
 *   node scripts/generate-og-images.ts
 *
 * Or via Yarn workspace script:
 *   yarn workspace bascik-docs generate:og
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV } from './nav.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(__dirname, '..');
const distOgDir = join(docsDir, 'dist', 'assets', 'og');

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripMd(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/gm, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapText(text: string, maxCharsPerLine: number, maxLines?: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (maxLines && lines.length >= maxLines) break;
    }
  }

  if (currentLine && (!maxLines || lines.length < maxLines)) {
    lines.push(currentLine);
  }

  // Prevent single-word orphan lines on the last line
  if (lines.length >= 2) {
    const lastLine = lines[lines.length - 1];
    const prevLine = lines[lines.length - 2];
    const lastWords = lastLine.split(' ');
    const prevWords = prevLine.split(' ');

    if (lastWords.length === 1 && prevWords.length >= 3) {
      const movedWord = prevWords.pop()!;
      lines[lines.length - 2] = prevWords.join(' ');
      lines[lines.length - 1] = movedWord + ' ' + lastLine;
    }
  }

  return lines;
}

async function readMd(href: string): Promise<string | null> {
  const standard = join(docsDir, 'content', href.slice(1) + '.md');
  try { return await readFile(standard, 'utf8'); } catch { }
  const base = join(docsDir, 'content', href.split('/').pop()! + '.md');
  try { return await readFile(base, 'utf8'); } catch { }
  return null;
}

function extractMetaFromMd(
  md: string,
  fallbackLabel: string
): { title: string; description: string; codeSnippet?: string; codeLang?: string } {
  // Strip multiline HTML comments before line scanning
  const cleanMd = md.replace(/<!--[\s\S]*?-->/g, '');
  const lines = cleanMd.split('\n');
  const h1Line = lines.find((l) => /^# /.test(l));
  const rawTitle = h1Line ? h1Line.slice(2).trim() : fallbackLabel;
  const title = stripMd(rawTitle);

  // 1. Extract first verbatim prose paragraph
  let pastH1 = false;
  const paragraphLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^# /.test(line)) {
      pastH1 = true;
      continue;
    }
    if (!pastH1) continue;

    const trimmed = line.trim();
    if (/^#{2,6}\s+/.test(trimmed)) continue;
    if (trimmed.startsWith('```')) continue;
    if (/^[-*_]{3,}$/.test(trimmed)) continue;
    if (trimmed === '**Legend**' || trimmed.startsWith('**Legend**')) continue;
    if (/^[-*]\s+/.test(trimmed)) continue;
    if (/^\|.*\|$/.test(trimmed)) continue;

    if (trimmed.length === 0) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    paragraphLines.push(trimmed);
  }

  const description = stripMd(paragraphLines.join(' ')) || 'HTML components. Zero runtime.';

  // 2. Extract first fenced code block in the entire document
  let codeSnippet: string | undefined;
  let codeLang: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('```')) {
      codeLang = line.slice(3).trim() || 'code';
      const codeLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith('```')) break;
        codeLines.push(lines[j]);
      }
      if (codeLines.length > 0) {
        codeSnippet = codeLines.slice(0, 11).join('\n');
      }
      break;
    }
  }

  return { title, description, codeSnippet, codeLang };
}

function highlightCodeLine(line: string): string {
  // Truncate line if longer than 48 chars
  const truncated = line.length > 48 ? line.slice(0, 47) + '…' : line;

  // Preserve exact leading whitespace with non-breaking spaces
  const leadingSpaces = truncated.match(/^[\s\t]*/)?.[0] ?? '';
  const content = truncated.slice(leadingSpaces.length);
  const indentSvg = leadingSpaces.replace(/ /g, '&#160;').replace(/\t/g, '&#160;&#160;');

  if (!content) {
    return `<tspan fill="#f0f1f2">${indentSvg}</tspan>`;
  }

  // Handle full line comments
  if (/^\s*(<!--|\/\*|\/\/)/.test(content)) {
    return `<tspan fill="#f0f1f2">${indentSvg}</tspan><tspan fill="#7e8190">${escapeXml(content)}</tspan>`;
  }

  // Tokenize line content
  const tokenRegex = /(".*?"|'[^']*'|`.*?`|<\/?[a-zA-Z0-9_-]+|\/?>|data-bascik-[a-zA-Z0-9_-]+|\.[a-zA-Z0-9_-]+|\b(?:const|let|var|function|import|export|from|return|await|npm|npx|yarn|git)\b|[a-zA-Z0-9_-]+(?=\s*=)|[a-zA-Z0-9_-]+(?=\s*:))/g;

  let result = `<tspan fill="#f0f1f2">${indentSvg}</tspan>`;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result += `<tspan fill="#f0f1f2">${escapeXml(content.slice(lastIndex, match.index))}</tspan>`;
    }

    const token = match[0];
    lastIndex = tokenRegex.lastIndex;

    if (/^["'`].*["'`]$/.test(token)) {
      // String
      result += `<tspan fill="#a6e3a1">${escapeXml(token)}</tspan>`;
    } else if (token.startsWith('</') || token.startsWith('<')) {
      // Tag start: e.g. <section or </p
      const isClose = token.startsWith('</');
      const bracket = isClose ? '&lt;/' : '&lt;';
      const tagName = isClose ? token.slice(2) : token.slice(1);
      result += `<tspan fill="#89b4fa">${bracket}</tspan><tspan fill="#89ddff">${escapeXml(tagName)}</tspan>`;
    } else if (token === '>' || token === '/>') {
      // Tag end
      result += `<tspan fill="#89b4fa">${escapeXml(token)}</tspan>`;
    } else if (token.startsWith('data-bascik-')) {
      // Bascik attribute
      result += `<tspan fill="#d3ff8d">${escapeXml(token)}</tspan>`;
    } else if (token.startsWith('.')) {
      // CSS class selector
      result += `<tspan fill="#d3ff8d">${escapeXml(token)}</tspan>`;
    } else if (/^(?:const|let|var|function|import|export|from|return|await|npm|npx|yarn|git)$/.test(token)) {
      // Keyword
      result += `<tspan fill="#cba6f7">${escapeXml(token)}</tspan>`;
    } else if (content[match.index + token.length] === '=') {
      // HTML attribute name
      result += `<tspan fill="#89ddff">${escapeXml(token)}</tspan>`;
    } else if (content[match.index + token.length] === ':') {
      // CSS property name
      result += `<tspan fill="#cba6f7">${escapeXml(token)}</tspan>`;
    } else {
      result += `<tspan fill="#f0f1f2">${escapeXml(token)}</tspan>`;
    }
  }

  if (lastIndex < content.length) {
    result += `<tspan fill="#f0f1f2">${escapeXml(content.slice(lastIndex))}</tspan>`;
  }

  return result;
}

export function renderOgSvg(
  title: string,
  section: string,
  description: string,
  fileName = 'src/components/card.html',
  codeSnippet?: string
): string {
  const sectionUpper = section.toUpperCase();
  const badgeCharWidth = 8.5;
  const badgeWidth = Math.max(80, Math.round(sectionUpper.length * badgeCharWidth + 28));

  const titleLines = wrapText(title, 26, 3);
  const descLines = wrapText(description, 45);

  const titleStartY = 180;
  const titleLineHeight = 52;
  const descStartY = titleStartY + titleLines.length * titleLineHeight + 16;
  const descLineHeight = 30;

  // Format code snippet lines into SVG tspans
  const rawSnippet = codeSnippet || `<article class="card">\n  <h3 class="title">HTML Component</h3>\n  <div data-bascik-slot></div>\n</article>\n<style>\n  .card { background: var(--surface); }\n  .title { color: var(--accent); }\n</style>`;
  const snippetLines = rawSnippet.split('\n').slice(0, 10);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Bascik Dark Theme Background (#18191b) -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18191b" />
      <stop offset="100%" stop-color="#121314" />
    </linearGradient>

    <!-- Lime Glow Gradient (#d3ff8d) -->
    <radialGradient id="lime-glow" cx="80%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#d3ff8d" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#d3ff8d" stop-opacity="0" />
    </radialGradient>

    <!-- Code Window Clip Path -->
    <clipPath id="code-clip">
      <rect x="0" y="-15" width="390" height="280" />
    </clipPath>
  </defs>

  <!-- Base Backgrounds -->
  <rect width="1200" height="630" fill="url(#bg-grad)" />
  <rect width="1200" height="630" fill="url(#lime-glow)" />

  <!-- Outer Card Frame (Bascik surface #1e2022) -->
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="#1e2022" stroke="rgba(255, 255, 255, 0.07)" stroke-width="1.5" />

  <!-- Top Parallelogram Accent Line -->
  <polygon points="40,40 1160,40 1160,44 40,44" fill="#d3ff8d" />

  <!-- Header: Bascik Skewed Polygon Logo + Section Badge -->
  <g transform="translate(80, 85)">
    <!-- Actual Bascik Skewed Logo Polygon Mark -->
    <polygon points="5,0 95,0 88,24 0,24" fill="#d3ff8d" />
    <rect x="15" y="7" width="2" height="10" rx="1" fill="#0e0f10" />
    <text x="22" y="17" font-family="'Courier New', Courier, monospace" font-size="14" font-weight="800" fill="#0e0f10" letter-spacing="2">BASCIK</text>

    <!-- Skewed Section Badge -->
    <g transform="translate(112, -1)">
      <polygon points="4,0 ${badgeWidth},0 ${badgeWidth - 4},26 0,26" fill="rgba(211,255,141,0.12)" stroke="rgba(211,255,141,0.22)" stroke-width="1" />
      <text x="12" y="17" font-family="'SF Mono', Menlo, Monaco, monospace" font-size="12" font-weight="700" fill="#d3ff8d" letter-spacing="1">${escapeXml(sectionUpper)}</text>
    </g>
  </g>

  <!-- Left Column: Title & Description -->
  <g transform="translate(80, ${titleStartY})">
    <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="42" font-weight="800" fill="#f0f1f2">
      ${titleLines.map((line, i) => `<tspan x="0" y="${i * titleLineHeight}">${escapeXml(line)}</tspan>`).join('')}
    </text>
  </g>

  <g transform="translate(80, ${descStartY})">
    <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="20" font-weight="400" fill="#8d929e">
      ${descLines.map((line, i) => `<tspan x="0" y="${i * descLineHeight}">${escapeXml(line)}</tspan>`).join('')}
    </text>
  </g>

  <!-- Right Column: Code Window Preview Component -->
  <g transform="translate(650, 130)">
    <!-- Window Container (#0d0e0f code bg) -->
    <rect width="430" height="350" rx="10" fill="#0d0e0f" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    
    <!-- Window Header Bar -->
    <rect width="430" height="34" rx="10" fill="rgba(255,255,255,0.04)" />
    <circle cx="20" cy="17" r="5" fill="#ff5f56" />
    <circle cx="36" cy="17" r="5" fill="#ffbd2e" />
    <circle cx="52" cy="17" r="5" fill="#27c93f" />
    <text x="215" y="22" text-anchor="middle" font-family="'SF Mono', Menlo, Monaco, monospace" font-size="12" fill="#8d929e">${escapeXml(fileName)}</text>

    <!-- Code Snippet -->
    <g transform="translate(20, 68)" font-family="'SF Mono', 'Fira Code', Menlo, monospace" font-size="12" xml:space="preserve" clip-path="url(#code-clip)">
      ${snippetLines.map((line, i) => `<text y="${i * 24}">${highlightCodeLine(line)}</text>`).join('\n      ')}
    </g>
  </g>

  <!-- Footer -->
  <g transform="translate(80, 520)">
    <line x1="0" y1="-20" x2="1040" y2="-20" stroke="rgba(255,255,255,0.07)" stroke-width="1" />
    <text x="0" y="5" font-family="'SF Mono', Menlo, Monaco, monospace" font-size="14" font-weight="600" fill="#d3ff8d">HTML components. Zero runtime.</text>
    <text x="1040" y="5" text-anchor="end" font-family="'SF Mono', Menlo, Monaco, monospace" font-size="15" font-weight="700" fill="#d3ff8d">bascik.dev</text>
  </g>
</svg>`;
}

interface PageMeta {
  slug: string;
  section: string;
  title: string;
  description: string;
  fileName?: string;
  codeSnippet?: string;
}

export async function generateOgImages(): Promise<void> {
  await mkdir(distOgDir, { recursive: true });

  const pagesMap = new Map<string, PageMeta>();

  // Process home page + all documentation pages listed in NAV
  const allNavPages = [
    { href: '/', label: 'Bascik', section: 'Overview' },
    ...NAV.flatMap((sec) => sec.pages.map((p) => ({ ...p, section: sec.section }))),
  ];

  for (const { href, label, section } of allNavPages) {
    const slug = href === '/' ? 'home' : href.replace(/^\//, '').replace(/\//g, '-');

    // Try reading meta from corresponding src/pages/*.html shell
    const htmlRelPath = href === '/' ? 'index.html' : href.slice(1) + '.html';
    const htmlFile = join(docsDir, 'src', 'pages', htmlRelPath);
    let htmlMeta: { title: string; description: string } | null = null;
    try {
      const html = await readFile(htmlFile, 'utf8');
      htmlMeta = extractMetaFromHtml(html);
    } catch { }

    const md = await readMd(href);
    const mdMeta = md ? extractMetaFromMd(md, label) : { title: label, description: 'HTML components. Zero runtime.' };

    const title = mdMeta.title || htmlMeta?.title || label;
    const description = mdMeta.description || htmlMeta?.description || 'HTML components. Zero runtime.';
    const codeSnippet = mdMeta.codeSnippet;
    const fileName = `docs/content${href === '/' ? '/overview' : href}.md`;

    pagesMap.set(slug, { slug, section, title, description, fileName, codeSnippet });
  }

  // Render and write SVG for each documentation page
  for (const [slug, { section, title, description, fileName, codeSnippet }] of pagesMap) {
    const svg = renderOgSvg(title, section, description, fileName, codeSnippet);
    const outFile = join(distOgDir, `${slug}.svg`);
    await writeFile(outFile, svg, 'utf8');
  }
}

// Auto-run when executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  await generateOgImages();
}
