import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['stores.json', 'prices.json', 'recipes.json'];
for (const f of files) {
  const p = path.join(root, 'data/seed', f);
  const data = JSON.parse(await readFile(p, 'utf8'));
  const n = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`seed ok ${f} (${n} entries)`);
}
