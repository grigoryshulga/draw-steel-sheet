#!/usr/bin/env node
/** Reapply source metadata after translation; never translate or replace authored prose. */
import { readFileSync, unlinkSync } from 'node:fs';
import { walkJson } from './lib/common.mjs';
import { writeMonsterTranslation, numericTokens, MONSTER_CHAPTERS } from './lib/monster-import.mjs';

const records = JSON.parse(readFileSync('content/monsters/source.json', 'utf8')).records;
const articles = walkJson('content/rules/articles').map(file => ({ file, article: JSON.parse(readFileSync(file, 'utf8')) }));
const entities = new Map(walkJson('content/rules/entities').map(file => { const entity = JSON.parse(readFileSync(file, 'utf8')); return [entity.id, entity]; }));
for (const record of records) {
  const found = articles.find(({ article }) => article.id === record.articleId);
  if (!found) throw new Error(`Missing translation: ${record.sourcePath}`);
  const { article, file } = found;
  const markdown = record.kind ? entities.get(record.id)?.markdown : article.blocks.map(block => block.text).join('');
  if (!markdown || JSON.stringify(numericTokens(markdown)) !== JSON.stringify(numericTokens(record.markdown))) {
    throw new Error(`Numeric mismatch: ${record.sourcePath}`);
  }
  writeMonsterTranslation(record.sourcePath, { name: article.title, markdown });
  if (!file.includes(`/${MONSTER_CHAPTERS[record.section].dir}/`)) unlinkSync(file);
}
console.log(`Finalized ${records.length} translations; all numeric sequences preserved.`);
