import { spawn } from 'node:child_process';
import chokidar from 'chokidar';
import { BascikConfig } from './config.js';
import { eventEmitter } from './events.js';

const runScript = (scriptPath: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`[bascik] exec "${scriptPath}" exited with code ${code}`));
    });
    child.on('error', reject);
  });

/** Run all exec entries in order. Used during `--build`. */
export const runExecOnBuild = async (): Promise<void> => {
  const entries = BascikConfig.exec;
  if (!entries?.length) return;
  for (const entry of entries) {
    await runScript(entry.script);
  }
};

/**
 * Fire watch-enabled exec entries async on dev startup and set up chokidar
 * re-run watchers. Build-only entries (no `watch`) are skipped.
 */
export const startExecDev = (): void => {
  const entries = BascikConfig.exec;
  if (!entries?.length) return;
  for (const entry of entries) {
    if (!entry.watch) continue;
    let running = false;

    // Non-blocking startup run — no reload needed on first run
    running = true;
    runScript(entry.script)
      .catch((err) => console.error('[bascik] exec error:', err))
      .finally(() => { running = false; });

    const patterns = Array.isArray(entry.watch) ? entry.watch : [entry.watch];
    chokidar
      .watch(patterns, { ignoreInitial: true })
      .on('all', () => {
        if (running) return; // drop concurrent trigger
        running = true;
        runScript(entry.script)
          .then(() => eventEmitter.emit('asset-changed'))
          .catch((err) => console.error('[bascik] exec error:', err))
          .finally(() => { running = false; });
      });
  }
};
