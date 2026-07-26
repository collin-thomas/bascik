/**
 * @module build-scripts
 *
 * Build-time Script Execution
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `<script data-bascik-build>` blocks are executed at transpile time as
 * Node.js ESM modules.  Whatever the script writes to stdout is injected into
 * the page in place of the script tag.
 *
 * This lets you pull in external data — markdown files, JSON, API responses —
 * at build time and inline the generated HTML directly into the page.
 *
 * @example
 * ```html
 * <!-- src/components/blog-post.html -->
 * <script data-bascik-build>
 * import { readFile } from 'node:fs/promises';
 * import { marked }   from 'marked';
 * const md = await readFile('./content/posts/intro.md', 'utf8');
 * console.log(marked(md));
 * </script>
 * ```
 *
 * Rules
 * ──────────────────────────────────────────────────────────────────────────────
 * - The script is written to a temporary `.mjs` file and executed with the
 *   same Node.js binary that is running Bascik.
 * - Top-level `import` statements and top-level `await` are supported.
 * - The script's working directory is the project root (`process.cwd()`).
 * - Use `console.log()` or `process.stdout.write()` to output the HTML to
 *   inject.  Anything written to stderr is forwarded to Bascik's own stderr.
 * - The script tag (including its attributes and closing tag) is completely
 *   replaced by the stdout output.  If the script produces no output, the tag
 *   is replaced with an empty string.
 * - On execution error, Bascik logs a warning and removes the script tag from
 *   the output rather than aborting the build.
 * - Scripts run during both `bascik` (dev) and `bascik --build` (production).
 */
/**
 * Find every `<script data-bascik-build>` block in `html`, execute each as a
 * Node.js ESM module, and replace the tag with the script's stdout output.
 */
export declare const executeBuildScripts: (html: string, filePath?: string) => Promise<string>;
