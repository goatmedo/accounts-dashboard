// Builds the public dashboard page into ./_site:
//   _site/index.html = site/head.html + index.html (the same page used on claude.ai) + closing tags
//   _site/dash.js, _site/data/*.csv
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_site');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'data'), { recursive: true });

const head = readFileSync(join(HERE, 'site', 'head.html'), 'utf8');
const page = readFileSync(join(HERE, 'index.html'), 'utf8');
writeFileSync(join(OUT, 'index.html'), head + page + '\n</main>\n</body>\n</html>\n');
copyFileSync(join(HERE, 'site', 'dash.js'), join(OUT, 'dash.js'));
for (const f of ['accounts.csv', 'posts.csv', 'history.csv']) copyFileSync(join(HERE, 'data', f), join(OUT, 'data', f));
console.log('Built _site');
