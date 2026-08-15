/**
 * @module typescript
 *
 * Inline TypeScript Support
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bascik supports TypeScript in all three script contexts by marking the
 * `<script>` tag with `lang="ts"`:
 *
 *   Client scripts    — `<script lang="ts">` — types are STRIPPED at build
 *                       time (using Node's built-in `stripTypeScriptTypes`
 *                       from `node:module`) so the browser receives plain
 *                       JavaScript.  The stripped script then flows through
 *                       the normal scoping pipeline (id/name/class rewriting,
 *                       IIFE wrapping) exactly like a hand-written JS block.
 *
 *   Build scripts     — `<script data-bascik-build lang="ts">` — type
 *                       annotations are stripped in-process before the temp
 *                       `.mjs` execution file is written.  (Handled in
 *                       build-scripts.ts.)
 *
 *   Server scripts    — `<script data-bascik-server lang="ts">` — same as
 *                       build scripts, stripped at request time.  (Handled in
 *                       server-scripts.ts.)
 *
 * Type stripping is erasure-only: annotations are replaced with whitespace so
 * line/column numbers are preserved.  TypeScript syntax that REQUIRES code
 * generation (enums, namespaces with runtime code, parameter properties,
 * `experimentalDecorators`) is not supported in client scripts — Node's
 * stripper throws on those constructs and Bascik logs a warning identifying
 * the file.
 */

import { stripTypeScriptTypes } from "node:module";

// Matches a `lang` attribute whose value is ts / typescript (any casing,
// quoted or bare).  Used both to detect TS scripts and to remove the
// attribute from the emitted open tag.
const LANG_TS_ATTR_RE = /\s+lang\s*=\s*(?:"(?:ts|typescript)"|'(?:ts|typescript)'|(?:ts|typescript)(?=[\s>]))/i;

/** Return `true` if a `<script …>` open tag declares `lang="ts"` (or `lang="typescript"`). */
export const isTypeScriptOpenTag = (openTag: string): boolean =>
  LANG_TS_ATTR_RE.test(openTag);

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
  /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/script>)/gi;

/**
 * Find every client-side `<script lang="ts">` block in `html`, strip the type
 * annotations, and drop the `lang` attribute so the browser treats the output
 * as ordinary JavaScript.
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
  if (!LANG_TS_ATTR_RE.test(html)) return html;
  return html.replace(SCRIPT_BLOCK_RE, (match, open: string, code: string, close: string) => {
    if (!isTypeScriptOpenTag(open)) return match;
    // Node-executed scripts keep their TS source — Node runs it natively.
    if (/\bdata-bascik-(?:build|server)\b/i.test(open)) return match;
    try {
      const js = stripTypes(code);
      const cleanedOpen = open.replace(LANG_TS_ATTR_RE, "");
      return `${cleanedOpen}${js}${close}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const where = filePath ? ` in "${filePath}"` : "";
      console.warn(
        `[bascik] TypeScript strip error${where}: ${msg}\n` +
        `The <script lang="ts"> block was removed from the output. ` +
        `Note that enums, namespaces, and other TS syntax requiring code ` +
        `generation are not supported in client scripts.`,
      );
      return "";
    }
  });
};
