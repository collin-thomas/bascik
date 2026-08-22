#!/usr/bin/env node
/**
 * generate-og-images.ts
 *
 * Generates 1200x630 Open Graph social cards (JPEG) for all docs pages directly into
 * docs/dist/assets/og/[slug].jpg.
 *
 * It reads page structure from nav.ts, extracts metadata from content Markdown
 * files (or src/pages/*.html fallback), renders vector card SVG, and converts it
 * to optimized JPEG via @resvg/resvg-js and sharp.
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
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
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

    paragraphLines.push(line); // Preserve original line content (including backticks)
  }

  // Preserve raw content with inline backticks, just strip other block MD structures
  const description = paragraphLines.join(' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim() || 'HTML components. Zero runtime.';

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

function extractMetaFromHtml(html: string): { title: string; description: string } | null {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (!titleMatch && !descMatch) return null;
  return {
    title: titleMatch ? titleMatch[1].replace(/\s*-\s*Bascik Docs$/, '').trim() : '',
    description: descMatch ? descMatch[1].trim() : '',
  };
}

function formatTextWithCodeStyles(line: string, fill = '#a0a6b5'): string {
  // Regex to match `code` backtick sections
  const parts = line.split(/(`[^`]+`)/g);
  let xml = '';

  for (const part of parts) {
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      // Clean, recognizable inline code styling: Monospace font with lime-green color (#d3ff8d)
      xml += `<tspan font-family="'Fira Code', monospace" font-weight="700" fill="#d3ff8d">${escapeXml(codeText)}</tspan>`;
    } else {
      xml += `<tspan font-family="Inter, sans-serif" font-weight="400" fill="${fill}">${escapeXml(part)}</tspan>`;
    }
  }

  return xml;
}

function wrapDescription(text: string, maxCharsPerLine = 52, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';
  let truncated = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      if (lines.length === maxLines) {
        truncated = true;
        currentLine = word;
        break;
      }
      currentLine = word;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  } else if (lines.length === maxLines && truncated) {
    let last = lines[lines.length - 1];
    if (last.length + 3 > maxCharsPerLine) {
      last = last.slice(0, maxCharsPerLine - 3).trim();
    }
    lines[lines.length - 1] = last.replace(/[.,;!?]+$/, '') + '...';
  }

  return lines;
}

export function renderOgSvg(
  title: string,
  section: string,
  description: string,
  isHome = false
): string {
  if (isHome) {
    // 2. Special full-screen Hero layout for the home page (fallback card style)
    const titleLines = wrapText("HTML components. Zero runtime.", 20, 2);
    const descLines = wrapDescription(description, 52, 4);

    const titleStartY = 205; // Pushed down from 175 to add more vertical breathing room below logo
    const descStartY = 355; // Adjusted to match new title position
    const descLineHeight = 38;

    return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Bascik Dark Theme Background (#18191b -> #121314) -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18191b" />
      <stop offset="100%" stop-color="#121314" />
    </linearGradient>

    <!-- Lime Glow Radial Gradient - Large immersive background orb -->
    <radialGradient id="hero-lime-glow" cx="45%" cy="-5%" r="75%">
      <stop offset="0%" stop-color="#d3ff8d" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#d3ff8d" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Base Backgrounds -->
  <rect width="1200" height="630" fill="url(#bg-grad)" />
  <rect width="1200" height="630" fill="url(#hero-lime-glow)" />

  <!-- Outer Card Frame (Bascik surface #1e2022) -->
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="#1e2022" fill-opacity="0.25" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1.5" />

  <!-- Top Parallelogram Accent Line -->
  <polygon points="40,40 1160,40 1160,45 40,45" fill="#d3ff8d" />

  <!-- Header: Bascik Skewed Polygon Logo -->
  <g transform="translate(80, 75)">
    <!-- Actual Bascik Skewed Logo Polygon Mark (Slant: dx = 10 over height = 40) -->
    <polygon points="10,0 150,0 140,40 0,40" fill="#d3ff8d" />
    <rect x="22" y="11" width="3" height="18" rx="1.5" fill="#0e0f10" />
    <text x="33" y="27" font-family="Courier New, Courier, monospace" font-size="22" font-weight="800" fill="#0e0f10" letter-spacing="2.5">BASCIK</text>
  </g>

  <!-- Big Hero Title: split into "HTML components." (white) and "Zero runtime." (lime-green) -->
  <g transform="translate(80, ${titleStartY})">
    <text font-family="Inter, sans-serif" font-size="76" font-weight="800" fill="#f8fafc" letter-spacing="-0.03em">
      <tspan x="0" y="0">HTML components.</tspan>
      <tspan x="0" y="82" fill="#d3ff8d">Zero runtime.</tspan>
    </text>
  </g>

  <!-- Verbatim Description / Paragraph -->
  <g transform="translate(80, ${descStartY})">
    <text font-family="Inter, sans-serif" font-size="28" font-weight="400" fill="#a0a6b5" letter-spacing="-0.01em">
      ${descLines.map((line, i) => `<tspan x="0" y="${i * descLineHeight}">${escapeXml(line)}</tspan>`).join('')}
    </text>
  </g>

  <!-- Footer -->
  <g transform="translate(80, 520)">
    <line x1="0" y1="-25" x2="1040" y2="-25" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
    <text x="0" y="27" font-family="Inter, sans-serif" font-size="26" font-weight="800" fill="#d3ff8d" letter-spacing="-0.02em">HTML components. Zero runtime.</text>
    <text x="1040" y="27" text-anchor="end" font-family="Inter, sans-serif" font-size="26" font-weight="700" fill="#d3ff8d">bascik.dev</text>
  </g>
</svg>`;
  }

  // 1. Regular documentation page layout
  const sectionUpper = section.toUpperCase();
  const badgeCharWidth = 10;
  const badgeWidth = Math.max(90, Math.round(sectionUpper.length * badgeCharWidth + 24));

  const titleLines = wrapText(title, 24, 2);
  const descLines = wrapDescription(description, 48, 3);

  const titleStartY = 210; // Pushed down from 180 to add more vertical space below the logo header
  const titleLineHeight = 70;
  const descStartY = titleStartY + titleLines.length * titleLineHeight + 12; // Snug vertical spacing
  const descLineHeight = 38;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Bascik Dark Theme Background (#18191b -> #121314) -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18191b" />
      <stop offset="100%" stop-color="#121314" />
    </linearGradient>

    <!-- Lime Glow Gradient (#d3ff8d) -->
    <radialGradient id="lime-glow" cx="85%" cy="15%" r="60%">
      <stop offset="0%" stop-color="#d3ff8d" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#d3ff8d" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Base Backgrounds -->
  <rect width="1200" height="630" fill="url(#bg-grad)" />
  <rect width="1200" height="630" fill="url(#lime-glow)" />

  <!-- Outer Card Frame (Bascik surface #1e2022) -->
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="#1e2022" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1.5" />

  <!-- Top Parallelogram Accent Line -->
  <polygon points="40,40 1160,40 1160,45 40,45" fill="#d3ff8d" />

  <!-- Header: Bascik Skewed Polygon Logo + Section Badge -->
  <g transform="translate(80, 75)">
    <!-- Actual Bascik Skewed Logo Polygon Mark (Slant: dx = 10 over height = 40) -->
    <polygon points="10,0 150,0 140,40 0,40" fill="#d3ff8d" />
    <rect x="22" y="11" width="3" height="18" rx="1.5" fill="#0e0f10" />
    <text x="33" y="27" font-family="Courier New, Courier, monospace" font-size="22" font-weight="800" fill="#0e0f10" letter-spacing="2.5">BASCIK</text>

    <!-- Skewed Section Badge (Exact same dx = 10 slant as Logo) -->
    <g transform="translate(166, 0)">
      <polygon points="10,0 ${badgeWidth + 10},0 ${badgeWidth},40 0,40" fill="rgba(211,255,141,0.12)" stroke="rgba(211,255,141,0.28)" stroke-width="1.5" />
      <text x="${Math.round((badgeWidth + 10) / 2)}" y="26" text-anchor="middle" font-family="Courier New, Courier, monospace" font-size="15" font-weight="700" fill="#d3ff8d" letter-spacing="1.5">${escapeXml(sectionUpper)}</text>
    </g>
  </g>

  <!-- Main Title (Big, Bold, Hero-style for Mobile & iMessage Previews) -->
  <g transform="translate(80, ${titleStartY})">
    <text font-family="Inter, sans-serif" font-size="64" font-weight="800" fill="#f8fafc" letter-spacing="-0.03em">
      ${titleLines.map((line, i) => `<tspan x="0" y="${i * titleLineHeight}">${escapeXml(line)}</tspan>`).join('')}
    </text>
  </g>

  <!-- Verbatim Subtitle / Description -->
  <g transform="translate(80, ${descStartY})">
    <text font-size="28" font-weight="400" fill="#a0a6b5" letter-spacing="-0.01em">
      ${descLines.map((line, i) => `<tspan x="0" y="${i * descLineHeight}">${formatTextWithCodeStyles(line, '#a0a6b5')}</tspan>`).join('')}
    </text>
  </g>

  <!-- Footer -->
  <g transform="translate(80, 520)">
    <line x1="0" y1="-25" x2="1040" y2="-25" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
    <text x="0" y="27" font-family="Inter, sans-serif" font-size="26" font-weight="800" fill="#d3ff8d" letter-spacing="-0.02em">HTML components. Zero runtime.</text>
    <text x="1040" y="27" text-anchor="end" font-family="Inter, sans-serif" font-size="26" font-weight="700" fill="#d3ff8d">bascik.dev</text>
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

    const title = href === '/' ? 'Bascik' : (mdMeta.title || htmlMeta?.title || label);
    const description = href === '/'
      ? "Bascik is a build tool for HTML components with automatically scoped CSS and JS. Zero runtime. The code that ships is the code you wrote."
      : (mdMeta.description || htmlMeta?.description || 'HTML components. Zero runtime.');
    const codeSnippet = mdMeta.codeSnippet;
    const fileName = `docs/content${href === '/' ? '/overview' : href}.md`;

    pagesMap.set(slug, { slug, section, title, description, fileName, codeSnippet });
  }

  // Load embedded font buffers so card rendering is 100% deterministic
  // across all build environments (macOS, Linux CI/Netlify, Windows, Docker).
  const fontsDir = join(__dirname, 'fonts');
  const fontBuffers = await Promise.all([
    readFile(join(fontsDir, 'Inter-400.woff')),
    readFile(join(fontsDir, 'Inter-700.woff')),
    readFile(join(fontsDir, 'Inter-900.woff')),
    readFile(join(fontsDir, 'FiraCode-700.woff')),
    readFile(join(fontsDir, 'CourierNew-400.ttf')),
    readFile(join(fontsDir, 'CourierNew-700.ttf')),
  ]);

  // Render SVG and convert to optimized JPEG for each documentation page
  await Promise.all(
    Array.from(pagesMap.entries()).map(async ([slug, { section, title, description }]) => {
      const isHome = slug === 'home';
      const svg = renderOgSvg(title, section, description, isHome);

      const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: 1200 },
        font: {
          fontBuffers,
          defaultFontFamily: 'Inter',
          sansSerifFamily: 'Inter',
          monospaceFamily: 'Courier New',
          loadSystemFonts: false,
        },
      });
      const pngBuffer = resvg.render().asPng();
      const jpgBuffer = await sharp(pngBuffer)
        .jpeg({ quality: 85, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
        .toBuffer();

      const outFile = join(distOgDir, `${slug}.jpg`);
      await writeFile(outFile, jpgBuffer);
    })
  );
}

// Auto-run when executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  await generateOgImages();
}
