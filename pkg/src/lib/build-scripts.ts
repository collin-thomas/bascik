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

import { execFile } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getRelativePath } from "./file-system.js";
import { BascikConfig } from "./config.js";


// Manual promise wrapper so tests can mock execFile with a plain vi.fn()
// without needing to simulate Node's promisify.custom symbol.
const runModule = (path: string): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path],
      {
        cwd: process.cwd(),
        env: { ...process.env, BASCIK_BUILD: BascikConfig.isBuild ? "1" : "0" },
      },
      (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
  });

// Match <script data-bascik-build …> … </script> (captures inner content)
const BUILD_SCRIPT_RE =
  /<script\b[^>]*\sdata-bascik-build\b[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Find every `<script data-bascik-build>` block in `html`, execute each as a
 * Node.js ESM module, and replace the tag with the script's stdout output.
 */
export const executeBuildScripts = async (html: string, filePath?: string): Promise<string> => {
  const matches = [...html.matchAll(BUILD_SCRIPT_RE)];
  if (matches.length === 0) return html;

  let result = html;

  // Ensure a temp directory exists for writing ephemeral build scripts.
  // Using node_modules/.cache keeps temp files within the project tree so
  // that Node.js ESM resolution can walk up and find the project's own
  // node_modules when build scripts import third-party packages (e.g. marked).
  const tempDir = join(process.cwd(), "node_modules", ".cache", "bascik");
  await mkdir(tempDir, { recursive: true });

  // Run build scripts sequentially to avoid spawning many Node processes at once,
  // which exhausts memory on constrained CI environments (e.g. Netlify's 2 GB VMs).
  const outputs: Array<{ fullTag: string; output: string }> = [];
  for (const match of matches) {
    const [fullTag, scriptContent] = match;
    const tmpPath = join(
      tempDir,
      `build-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
    );
    try {
      await writeFile(tmpPath, scriptContent.trim(), "utf8");
      const { stdout, stderr } = await runModule(tmpPath);
      if (stderr) process.stderr.write(stderr);
      outputs.push({ fullTag, output: stdout });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let errorMsg = `[bascik] build script error`;
      if (filePath) {
        const index = html.indexOf(fullTag);
        if (index !== -1) {
          const prefix = html.slice(0, index);
          const lines = prefix.split(/\r?\n/);
          errorMsg += ` in "${getRelativePath(filePath, "pages")}" at (line ${lines.length}, column ${lines[lines.length - 1].length + 1})`;
        } else {
          errorMsg += ` in "${getRelativePath(filePath, "pages")}"`;
        }
      }
      console.warn(`${errorMsg}:\n${msg}`);
      outputs.push({ fullTag, output: "" });
    } finally {
      await unlink(tmpPath).catch(() => { });
    }
  }

  for (const { fullTag, output } of outputs) {
    // Use a function replacement so that `$` characters in `output` (e.g.
    // `$&`, `$1` from code examples) are never interpreted as special patterns.
    result = result.replace(fullTag, () => output);
  }

  return result;
};
