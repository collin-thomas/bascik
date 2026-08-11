/**
 * @module server-scripts
 *
 * Server-time Script Execution
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `<script data-bascik-server>` blocks are executed at request time as
 * Node.js ESM modules.  Whatever the script writes to stdout is injected into
 * the page in place of the script tag, on every request.
 *
 * This lets you personalize pages at the HTTP layer — reading session cookies,
 * querying a database, or rendering content based on query parameters — without
 * a full framework.
 *
 * @example
 * ```html
 * <script data-bascik-server>
 * const req = JSON.parse(process.env.BASCIK_REQUEST);
 * const name = req.headers['x-display-name'] ?? 'Guest';
 * console.log(`<p>Welcome, ${name}</p>`);
 * </script>
 * ```
 *
 * Rules
 * ─────────────────────────────────────────────────────────────────────────────
 * - The script body is written to a temp `.mjs` file and run with the same
 *   Node.js binary that is running Bascik.
 * - Top-level `import` statements and top-level `await` are both supported.
 * - `process.env.BASCIK_REQUEST` contains JSON with four keys:
 *     `{ path, method, headers, searchParams }`
 *   – `path`         — the requested URL path without the query string
 *   – `method`       — the HTTP method in uppercase (e.g. `"GET"`)
 *   – `headers`      — an object of request header name → value strings
 *                      (HTTP/2 pseudo-headers like `:path` are excluded)
 *   – `searchParams` — an object of query-param key → value strings
 * - The script's working directory is the project root (`process.cwd()`).
 * - Use `console.log()` or `process.stdout.write()` to emit the HTML to
 *   inject.  Anything written to stderr is forwarded to the server's stderr.
 * - The script tag (including attributes and closing tag) is completely
 *   replaced by the stdout output.  Empty stdout → replaced with `""`.
 * - On execution error, Bascik logs a warning and removes the tag from the
 *   response rather than aborting the request.
 * - Unlike `data-bascik-build`, server scripts run on every request and are
 *   never cached.  They are NOT executed during `bascik --build`.
 */

import { execFile } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

/** Request context passed to every `data-bascik-server` script. */
export interface ServerRequest {
  /** URL path without the query string, e.g. `"/about"`. */
  path: string;
  /** HTTP method in uppercase, e.g. `"GET"`. */
  method: string;
  /**
   * Request headers as a plain object.
   * HTTP/2 pseudo-headers (`:path`, `:method`, etc.) are excluded.
   */
  headers: Record<string, string>;
  /** Parsed query parameters as a plain string-to-string object. */
  searchParams: Record<string, string>;
}

// Match <script data-bascik-server …> … </script> (captures inner content).
// The attribute section uses an alternation that consumes either a complete
// double-quoted value, a single-quoted value, or any non-quote, non->
// character — this prevents a match when "data-bascik-server" appears only
// inside an attribute value such as title="run data-bascik-server later".
// Flag 'g' is required for matchAll; lastIndex is reset manually before each use.
const SERVER_SCRIPT_RE =
  /<script\b(?:[^>"']|"[^"]*"|'[^']*')*\sdata-bascik-server\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/script>/gi;

/** Return `true` if `html` contains at least one `data-bascik-server` block. */
export const htmlHasServerScripts = (html: string): boolean => {
  SERVER_SCRIPT_RE.lastIndex = 0;
  return SERVER_SCRIPT_RE.test(html);
};

/** Default execution timeout per server-script child process (ms). */
export const DEFAULT_SCRIPT_TIMEOUT_MS = 30_000;

/**
 * Maximum number of server-script child processes that may run concurrently
 * per request.  Prevents a single page with many server blocks from spawning
 * an unbounded number of child processes at once.
 */
const MAX_CONCURRENT_SCRIPTS = Math.max(4, os.availableParallelism?.() ?? os.cpus().length);

// Manual promise wrapper keeps the same shape as the one in build-scripts.ts
// so tests can mock execFile with a plain vi.fn() without simulating
// Node's promisify.custom symbol.
const runModule = (
  path: string,
  request: ServerRequest,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path],
      {
        cwd: process.cwd(),
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        env: {
          ...process.env,
          BASCIK_REQUEST: JSON.stringify(request),
        },
      },
      (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
  });

/**
 * Find every `<script data-bascik-server>` block in `html`, execute each as a
 * Node.js ESM module with the supplied request context, and replace the tag
 * with the script's stdout output.
 *
 * @param timeoutMs - Per-script execution deadline in milliseconds.
 *   Defaults to {@link DEFAULT_SCRIPT_TIMEOUT_MS}.  Scripts that exceed the
 *   deadline are killed (SIGKILL) and their block is removed from the output.
 */
export const executeServerScripts = async (
  html: string,
  request: ServerRequest,
  timeoutMs: number = DEFAULT_SCRIPT_TIMEOUT_MS,
): Promise<string> => {
  SERVER_SCRIPT_RE.lastIndex = 0;
  const matches = [...html.matchAll(SERVER_SCRIPT_RE)];
  if (matches.length === 0) return html;

  // Same temp-dir convention as build-scripts.ts: keeps script files inside
  // the project tree so ESM resolution can find the project's node_modules.
  const tempDir = join(process.cwd(), "node_modules", ".cache", "bascik");
  await mkdir(tempDir, { recursive: true });

  // Run at most MAX_CONCURRENT_SCRIPTS child processes at a time.
  const results: Array<{ fullTag: string; output: string }> = [];
  for (let i = 0; i < matches.length; i += MAX_CONCURRENT_SCRIPTS) {
    const batch = matches.slice(i, i + MAX_CONCURRENT_SCRIPTS);
    const batchResults = await Promise.all(
      batch.map(async (match) => {
        const [fullTag, scriptContent] = match;
        const tmpPath = join(
          tempDir,
          `server-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
        );
        try {
          await writeFile(tmpPath, scriptContent.trim(), "utf8");
          const { stdout, stderr } = await runModule(tmpPath, request, timeoutMs);
          if (stderr) process.stderr.write(stderr);
          return { fullTag, output: stdout };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[bascik] server script error at "${request.path}":\n${msg}`,
          );
          return { fullTag, output: "" };
        } finally {
          await unlink(tmpPath).catch(() => { });
        }
      }),
    );
    results.push(...batchResults);
  }

  let result = html;
  for (const { fullTag, output } of results) {
    // Use a function replacement so that `$` characters in `output` (e.g.
    // `$&`, `$1` from code examples) are never interpreted as special patterns.
    result = result.replace(fullTag, () => output);
  }
  return result;
};
