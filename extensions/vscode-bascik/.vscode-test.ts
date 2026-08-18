import { defineConfig } from '@vscode/test-cli';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  files: 'dist/test/**/*.test.js',
  workspaceFolder: path.join(__dirname, 'test-fixtures', 'sample-workspace'),
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  },
});
