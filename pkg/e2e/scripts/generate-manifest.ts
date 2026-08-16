import { writeFile } from 'node:fs/promises';

await writeFile('dist/exec-manifest.json', JSON.stringify({ generated: true }));
