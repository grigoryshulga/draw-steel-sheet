#!/usr/bin/env node
/** Editorial normalization of recurring headings, preserving source mechanics. */
import { readFileSync, writeFileSync } from 'node:fs';
import { walkJson } from './lib/common.mjs';
import { numericTokens } from './lib/monster-import.mjs';

const source = JSON.parse(readFileSync('content/monsters/source.json', 'utf8'));
const glossary = JSON.parse(readFileSync('content/monsters/glossary.json', 'utf8'));
const preferred = new Map(glossary.recurringFeatures.map(term => [term.en, term.ru]));
const headers = text => [...text.matchAll(/^>\s*(?:[^\w\s*]+\s*)?\*\*(.+?)\*\*\s*$/gm)].map(match => match[1]);
const sources = new Map(source.records.map(record => [record.id, record]));
let count = 0;
for (const file of walkJson('content/rules/entities')) {
  const entity = JSON.parse(readFileSync(file, 'utf8'));
  if (!entity.director) continue;
  const record = sources.get(entity.id);
  const original = headers(record.markdown);
  const translated = headers(entity.markdown);
  if (original.length !== translated.length) continue;
  let next = entity.markdown;
  for (let index = 0; index < original.length; index++) {
    const en = original[index].replace(/ \([^)]*\)$/, '');
    const ru = translated[index].replace(/ \([^)]*\)$/, '');
    if (preferred.has(en) && ru !== preferred.get(en)) next = next.replaceAll(ru, preferred.get(en));
  }
  next = next.replace(/фирменная способность/gi, 'Знаковая способность')
    .replace(/Бросок силы \+ (?:самая высокая|высшая) характеристика/g, 'Бросок силы + наивысшая характеристика')
    .replace(/радэн/gi, match => match[0] === 'Р' ? 'Раден' : 'раден');
  if (next === entity.markdown) continue;
  if (JSON.stringify(numericTokens(next)) !== JSON.stringify(numericTokens(entity.markdown))) throw new Error(`Numeric change: ${file}`);
  entity.markdown = next;
  writeFileSync(file, JSON.stringify(entity, null, 2) + '\n');
  count++;
}
console.log(`Normalized recurring terms in ${count} entities; numeric sequences unchanged.`);
