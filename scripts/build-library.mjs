import { readFileSync, writeFileSync } from 'node:fs';

// UI catalog/tooltips need only these chapters, not the complete rulebook.
export function selectLibraryArticles(articles) {
  return articles.filter(({ id, chapter }) =>
    id === '0102' || /^(16|18|19)\./.test(chapter));
}

const source = new URL('../src/data/codex.generated.json', import.meta.url);
const target = new URL('../src/data/library-articles.generated.json', import.meta.url);
const articles = selectLibraryArticles(JSON.parse(readFileSync(source, 'utf8')));
writeFileSync(target, JSON.stringify(articles));
console.log(`Library: ${articles.length} articles`);
