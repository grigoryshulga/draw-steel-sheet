#!/usr/bin/env node
// Audit the committed delivery, not the authoring maps or projections.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('src/generated/rules');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const articles = [];
const entities = new Map();
for (const file of readdirSync(`${root}/packs`).filter((name) => name.endsWith('.json')).sort()) {
  const pack = read(`${root}/packs/${file}`);
  articles.push(...pack.articles);
  for (const entity of pack.entities) entities.set(entity.id, entity);
}
const state = (record) => record.originalDescription?.trim() ? 'text-present'
  : record.originalName?.trim() ? 'title-only' : 'missing';
const tally = (records, group) => {
  const result = {};
  for (const record of records) {
    const key = group(record);
    result[key] ??= { total: 0, 'text-present': 0, 'title-only': 0, missing: 0 };
    result[key].total++;
    result[key][state(record)]++;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, 'en')));
};
const allEntities = [...entities.values()];
console.log(JSON.stringify({
  articles: tally(articles, (record) => record.chapter),
  entities: tally(allEntities, (record) => record.kind),
  missingArticles: articles.filter((record) => state(record) !== 'text-present').map(({ id, title }) => ({ id, title })).sort((a, b) => a.id.localeCompare(b.id, 'en')),
  unverifiedEntities: allEntities.filter((record) => record.originalCoverage?.status === 'excerpt').map(({ id, name, kind, originalId, source }) => ({ id, name, kind, originalId: originalId || null, articleId: source?.articleId })).sort((a, b) => a.id.localeCompare(b.id, 'en')),
  entitiesWithoutText: allEntities.filter((record) => state(record) !== 'text-present').map(({ id, name, kind }) => ({ id, name, kind })).sort((a, b) => a.id.localeCompare(b.id, 'en')),
}, null, 2));
