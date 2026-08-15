/**
 * @module typescript
 *
 * Inline TypeScript Support
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bascik supports TypeScript in all three script contexts by marking the
 * `<script>` tag with the `data-bascik-ts` attribute (a standard HTML
 * `data-*` attribute — Bascik never invents non-standard syntax):
 *
 *   Client scripts    — `<script data-bascik-ts>` — types are STRIPPED at
 *                       build time (using Node's built-in
 *                       `stripTypeScriptTypes` from `node:module`) so the
 *                       browser receives plain JavaScript.  The stripped
 *                       script then flows through the normal scoping pipeline
 *                       (id/name/class rewriting, IIFE wrapping) exactly like
 *                       a hand-written JS block.
 *
 *   Build scripts     — `<script data-bascik-build data-bascik-ts>` — type
 *                       annotations are stripped in-process before the temp
 *                       `.mjs` execution file is written.  (Handled in
 *                       build-scripts.ts.)
 *
 *   Server scripts    — `<script data-bascik-server data-bascik-ts>` — same
 *                       as build scripts, stripped at request time.  (Handled
 *                       in server-scripts.ts.)
 *
 * Type stripping is erasure-only: annotations are replaced with whitespace so
 * line/column numbers are preserved.  TypeScript syntax that REQUIRES code
 * generation (enums, namespaces with runtime code, parameter properties,
 * `experimentalDecorators`) is not supported in client scripts — Node's
 * stripper throws on those constructs and Bascik logs a warning identifying
 * the file.
 */

import { stripTypeScriptTypes } from "node:module";

// Quote-aware detection of the `data-bascik-ts` flag: quoted attribute values
// are consumed first so the flag is only recognised as an actual attribute
// name — never as a substring of another attribute's value.  The flag may be
// boolean or carry any value (quoted or bare).
const QUOTED_OR_TS_FLAG_RE =
  /("[^"]*"|'[^']*')|(\s+data-bascik-ts(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?(?=[\s>]))/gi;

// Same quote-aware shape for the Node-executed script markers.
const QUOTED_OR_NODE_FLAG_RE =
  /("[^"]*"|'[^']*')|(\s+data-bascik-(?:build|server)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?(?=[\s>]))/gi;

// Quote-aware flag detection: quoted values are consumed first, so the flag is
// only recognised as an actual attribute name.
const hasFlagAttr = (openTag: string, re: RegExp): boolean => {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(openTag)) !== null) {
    if (m[2] !== undefined) return true;
  }
  return false;
};

/** Return `true` if a `<script …>` open tag declares `data-bascik-ts`. */
export const isTypeScriptOpenTag = (openTag: string): boolean =>
  hasFlagAttr(openTag, QUOTED_OR_TS_FLAG_RE);

/** Remove the `data-bascik-ts` attribute from an open tag (quote-aware). */
const removeTsFlag = (openTag: string): string =>
  openTag.replace(QUOTED_OR_TS_FLAG_RE, (match, quoted) =>
    quoted !== undefined ? match : "",
  );

/**
 * Strip TypeScript type annotations from `source`, returning plain JavaScript.
 * Uses Node's built-in erasure-only stripper — annotations become whitespace,
 * so line numbers (and Bascik's scoping regexes) are unaffected.
 * Throws on TS syntax that requires code generation (enums, namespaces, …).
 */
export const stripTypes = (source: string): string =>
  // mode "strip" (the default) is erasure-only and needs no sourcemaps —
  // output positions match input positions exactly.
  stripTypeScriptTypes(source, { mode: "strip" });

// Quote-aware <script> scanner (same shape as build-scripts.ts): an attribute
// value may contain `>` so consume quoted strings rather than [^>]*.
const SCRIPT_BLOCK_RE =
  /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/script\s*>)/gi;

// Same raw-text masking convention used elsewhere in the repo: preserve string
// length by blanking raw-text element content with spaces before scanning for
// real markup.
const RAW_TEXT_CONTENT_RE =
  /(<(style|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/\2\s*>)/gi;

const maskRawTextContent = (html: string): string =>
  html.replace(
    RAW_TEXT_CONTENT_RE,
    (_match, open: string, _tag: string, content: string, close: string) =>
      `${open}${" ".repeat(content.length)}${close}`,
  );

/**
 * Find every client-side `<script data-bascik-ts>` block in `html`, strip the
 * type annotations, and drop the `data-bascik-ts` attribute so the browser
 * treats the output as ordinary JavaScript.
 *
 * `data-bascik-build` and `data-bascik-server` scripts are left untouched —
 * their TS handling happens at execution time in build-scripts.ts and
 * server-scripts.ts respectively.
 *
 * On a stripping error (unsupported TS syntax, parse error) Bascik logs a
 * warning naming the file and removes the script block from the output rather
 * than shipping raw TypeScript to the browser.
 */
export const transpileInlineTypeScript = (
  html: string,
  filePath?: string,
): string => {
  if (!/data-bascik-ts/i.test(html)) return html;
  const maskedHtml = maskRawTextContent(html);
  const matches = [...maskedHtml.matchAll(SCRIPT_BLOCK_RE)];
  if (matches.length === 0) return html;

  let result = html;
  const outputs = matches.map((match) => {
    const [fullTag, open, _maskedCode, close] = match;
    const index = match.index ?? 0;
    const originalTag = html.slice(index, index + fullTag.length);
    const originalOpen = html.slice(index, index + open.length);
    const originalCode = html.slice(index + open.length, index + fullTag.length - close.length);
    const originalClose = html.slice(index + fullTag.length - close.length, index + fullTag.length);
    if (!isTypeScriptOpenTag(originalOpen)) return { fullTag: originalTag, index, output: originalTag };
    // Node-executed scripts keep their TS source — Node runs it natively.
    if (hasFlagAttr(originalOpen, QUOTED_OR_NODE_FLAG_RE)) {
      return { fullTag: originalTag, index, output: originalTag };
    }
    try {
      const js = stripTypes(originalCode);
      const cleanedOpen = removeTsFlag(originalOpen);
      return { fullTag: originalTag, index, output: `${cleanedOpen}${js}${originalClose}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const where = filePath ? ` in "${filePath}"` : "";
      console.warn(
        `[bascik] TypeScript strip error${where}: ${msg}\n` +
        `The <script data-bascik-ts> block was removed from the output. ` +
        `Note that enums, namespaces, and other TS syntax requiring code ` +
        `generation are not supported in client scripts.`,
      );
      return { fullTag: originalTag, index, output: "" };
    }
  });

  outputs.sort((a, b) => b.index - a.index);
  for (const { fullTag, index, output } of outputs) {
    result = result.slice(0, index) + output + result.slice(index + fullTag.length);
  }
  return result;
};
