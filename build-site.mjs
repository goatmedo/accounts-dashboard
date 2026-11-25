// Builds the public stats page into ./_site: site/ (index.html, style.css, app.js) + data/*.csv
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_site');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'data'), { recursive: true });
for (const f of ['index.html', 'style.css', 'app.js']) copyFileSync(join(HERE, 'site', f), join(OUT, f));
for (const f of ['accounts.csv', 'posts.csv', 'history.csv']) copyFileSync(join(HERE, 'data', f), join(OUT, 'data', f));
console.log('Built _site');
