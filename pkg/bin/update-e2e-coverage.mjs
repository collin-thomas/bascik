#!/usr/bin/env node
/**
 * Collects E2E coverage by running the built Bascik CLI in multiple modes
 * under NODE_V8_COVERAGE, then producing a json-summary report.
 *
 * Steps:
 *   1. --build       (primary transpilation pipeline + sitemap + workers)
 *   2. --help        (help action in index.ts / cli.ts)
 *   3. --version     (readVersion + version action)
 *   4. --check       (checkProject, file-system listPages/listComponents)
 *   5. --build --log (log-path branch, resolveBuildLogPath, tee closures)
 *   6. dev server    (boot → HTTP requests → file-touch watch events → kill)
 *                    Covers mem.ts, pki.ts, http2.ts, server-scripts.ts,
 *                    and processing.ts dev-mode functions
 *   7. --serve       (isServe=true branches in config.ts; index.ts serve action)
 */

import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http2 from 'node:http2';

const pkgDir = join(fileURLToPath(import.meta.url), '../..');
const e2eDir = join(pkgDir, 'e2e');
const cli = join(pkgDir, 'dist/index.js');
const covDir = join(pkgDir, 'coverage/e2e');
const repDir = join(pkgDir, 'coverage/e2e-report');
const c8 = join(pkgDir, '..', 'node_modules/.bin/c8');

rmSync(covDir, { recursive: true, force: true });
mkdirSync(covDir, { recursive: true });
mkdirSync(repDir, { recursive: true });

const env = { ...process.env, NODE_V8_COVERAGE: covDir };

const run = (args) => {
  try {
    execSync(`node "${cli}" ${args}`, { cwd: e2eDir, env, stdio: 'pipe' });
  } catch { /* non-zero exits still capture coverage */ }
};

console.log('[1/7] --build');
run('--build');

console.log('[2/7] --help');
run('--help');

console.log('[3/7] --version');
run('--version');

console.log('[4/7] --check');
run('--check');

console.log('[5/7] --build --log');
run(`--build --log "${join(pkgDir, 'coverage/e2e-build.log')}"`);

// ── Step 6: Dev server + HTTP requests + file-touch ──────────────────────────

console.log('[6/7] dev server boot → HTTP requests → watch events');

// HTTP/2 request — bascik's dev server only accepts HTTP/2, not HTTP/1.1
const h2req = (method, path, port = 9443, extraHeaders = {}) => new Promise((resolve) => {
  const client = http2.connect(`https://localhost:${port}`, { rejectUnauthorized: false });
  client.on('error', () => { client.destroy(); resolve(0); });
  const req = client.request({ ':method': method, ':path': path, ...extraHeaders });
  req.on('response', (h) => { req.resume(); resolve(h[':status'] ?? 0); });
  req.on('error', () => resolve(0));
  req.on('end', () => client.close());
  req.setTimeout(4000, () => { req.close(http2.constants.NGHTTP2_CANCEL); resolve(0); });
  req.end();
});

// SSE: connect with referer so mem.trackOpenPage fires, then disconnect after brief delay
const h2sse = (port = 9443) => new Promise((resolve) => {
  const client = http2.connect(`https://localhost:${port}`, { rejectUnauthorized: false });
  client.on('error', () => { client.destroy(); resolve(); });
  const req = client.request({
    ':method': 'GET', ':path': '/bascik-live-reload',
    'referer': `https://localhost:${port}/scope-test`,
  });
  req.on('response', () => { setTimeout(() => { req.close(); client.close(); resolve(); }, 500); });
  req.on('error', () => resolve());
  req.end();
});

await new Promise((resolve) => {
  const devProc = spawn('node', [cli], { cwd: e2eDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let done = false;
  let ready = false;
  const kill = () => { if (!done) { done = true; devProc.kill('SIGTERM'); } };
  const timeout = setTimeout(() => {
    if (!ready) console.warn('  [warn] dev server did not start — run from a normal terminal for full coverage.');
    kill();
  }, 15_000);

  const runRequests = async () => {
    await new Promise(r => setTimeout(r, 400));
    await h2req('GET', '/scope-test');             // mem.getPage, http2 stream handler
    await h2req('GET', '/');                        // mem.getPageExact trailing-slash variant
    await h2req('GET', '/server-scripts-test');    // server-scripts.ts executeServerScripts
    await h2req('GET', '/nonexistent-xyz');        // http2 404 path
    await h2req('POST', '/scope-test');             // http2 405 method-not-allowed
    await h2req('HEAD', '/scope-test');             // http2 HEAD branch
    await h2sse();                                  // mem.trackOpenPage + http2 SSE + mem.untrackOpenPage

    // Touch a component → chokidar → selectivelyProcessPages → pageProcessing
    const comp = join(e2eDir, 'src/components/scope-test/scope-test.html');
    if (existsSync(comp)) { const now = new Date(); utimesSync(comp, now, now); }
    // Touch a page → chokidar → selectivelyProcessPagesForWatchPath
    const page = join(e2eDir, 'src/pages/css-scope-test.html');
    if (existsSync(page)) { const now = new Date(); utimesSync(page, now, now); }
    await new Promise(r => setTimeout(r, 3000)); // let watch events fire + reprocess
    clearTimeout(timeout);
    kill();
  };

  devProc.stdout.on('data', (chunk) => {
    const s = chunk.toString();
    process.stdout.write(s);
    if (!ready && (s.includes('Server running') || s.includes('https://localhost'))) {
      ready = true;
      runRequests().catch(() => kill());
    }
  });
  devProc.stderr.on('data', (chunk) => {
    const s = chunk.toString();
    if (!s.includes('SIGTERM') && !s.includes('gracefully')) process.stderr.write(s);
  });
  devProc.on('close', (code) => {
    clearTimeout(timeout);
    if (!ready) console.warn(`  [warn] dev server exited (code ${code}) before ready.`);
    resolve();
  });
});

// ── Step 7: --serve (isServe=true branches in config.ts) ─────────────────────

console.log('[7/7] --serve brief run');
await new Promise((resolve) => {
  const serveProc = spawn('node', [cli, '--serve'], {
    cwd: e2eDir, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const timeout = setTimeout(() => serveProc.kill('SIGTERM'), 8_000);
  serveProc.stdout.on('data', (chunk) => {
    const s = chunk.toString();
    process.stdout.write(s);
    if (s.includes('Server running') || s.includes('https://localhost')) {
      clearTimeout(timeout);
      setTimeout(() => serveProc.kill('SIGTERM'), 300);
    }
  });
  serveProc.stderr.on('data', (chunk) => {
    const s = chunk.toString();
    if (!s.includes('SIGTERM') && !s.includes('gracefully')) process.stderr.write(s);
  });
  serveProc.on('close', () => { clearTimeout(timeout); resolve(); });
});

// ── Report ────────────────────────────────────────────────────────────────────

console.log('\nGenerating coverage report…');
execSync(
  `"${c8}" report --temp-directory "${covDir}" -r json-summary -o "${repDir}"`,
  { cwd: pkgDir, stdio: 'inherit' },
);
execSync(`cp "${repDir}/coverage-summary.json" "${join(pkgDir, 'e2e-test-coverage.json')}"`, { cwd: pkgDir });
console.log('Done → e2e-test-coverage.json');
process.exit(0);
