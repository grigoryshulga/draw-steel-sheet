import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

// Run against the production graph, including transitive static dependencies.
const directory = process.argv[2] ?? 'dist';
const manifest = JSON.parse(await fs.readFile(path.join(directory, '.vite/manifest.json'), 'utf8'));
function closure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const dependency of manifest[key].imports ?? []) closure(dependency, seen);
  return seen;
}
async function measure(key) {
  const files = new Set([...closure(key)].map((id) => manifest[id].file));
  let raw = 0, gzip = 0, brotli = 0;
  for (const file of files) {
    const data = await fs.readFile(path.join(directory, file));
    raw += data.length;
    gzip += (await fs.readFile(path.join(directory, `${file}.gz`)).catch(() => gzipSync(data))).length;
    brotli += (await fs.readFile(path.join(directory, `${file}.br`)).catch(() => brotliCompressSync(data))).length;
  }
  return { raw, gzip, brotli };
}
// Include headroom for the optional Supabase SDK; rule data must stay lazy.
const budgets = {
  'index.html': { raw: 512, gzip: 160 },
  'src/WorkspaceApp.tsx': { raw: 3100, gzip: 650 },
  'src/views/CodexView.tsx': { raw: 1500, gzip: 360 },
  'src/views/CatalogView.tsx': { raw: 2600, gzip: 620 },
  'src/views/SheetView.tsx': { raw: 5000, gzip: 1080 },
};
const routes = Object.keys(budgets);
for (const route of routes) {
  const key = Object.keys(manifest).find((key) => manifest[key].src === route);
  if (!key) throw new Error(`Missing build entry: ${route}`);
  const size = await measure(key);
  console.log(`${route}: raw ${(size.raw / 1024).toFixed(1)} KiB, gzip ${(size.gzip / 1024).toFixed(1)} KiB, br ${(size.brotli / 1024).toFixed(1)} KiB`);
  const budget = budgets[route];
  if (size.raw > budget.raw * 1024 || size.gzip > budget.gzip * 1024) {
    throw new Error(`${route} exceeds the ${budget.raw} KiB raw / ${budget.gzip} KiB gzip budget`);
  }
}

// Article prose must remain separate from JavaScript, even for tiny articles.
const rules = JSON.parse(await fs.readFile('src/generated/rules/manifest.json', 'utf8'));
const articleSizes = [];
for (const entry of rules.articles) {
  const asset = manifest[`src/generated/rules/articles/${entry.id}.json`];
  if (!asset || !asset.file.endsWith('.json')) throw new Error(`Article is not a separate JSON asset: ${entry.id}`);
  const data = await fs.readFile(path.join(directory, asset.file));
  const payload = JSON.parse(data);
  if (payload.articles.length !== 1 || payload.articles[0].id !== entry.id) {
    throw new Error(`Article asset includes an unexpected article: ${entry.id}`);
  }
  articleSizes.push(gzipSync(data).length);
}
articleSizes.sort((a, b) => a - b);
const medianArticle = articleSizes[Math.floor(articleSizes.length / 2)];
console.log(`Article JSON: ${articleSizes.length} separate assets, median gzip ${(medianArticle / 1024).toFixed(1)} KiB`);
if (medianArticle > 8 * 1024) throw new Error('Median article payload exceeds 8 KiB gzip');
