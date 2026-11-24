#!/usr/bin/env node
// Reproduce the two pinned source snapshots from a checkout of data-unified.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const revision = 'bdb12093b1d07bf8674453796eac907a09dd7dd3';
const checkout = process.argv[2];
const check = process.argv.includes('--check');
if (!checkout || checkout.startsWith('--')) throw new Error('Usage: node scripts/originals/import-scc-audit.mjs <data-unified checkout> [--check]');
const actual = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== revision) throw new Error(`Expected ${revision}, got ${actual}`);
const base = { repository: 'https://github.com/SteelCompendium/data-unified', revision };
const readSource = (file) => readFileSync(path.join(checkout, file), 'utf8');
const summonerPath = 'en/books/summoner/md-linked/class/summoner.md';
const source = readSource(summonerPath);
const marks = [...source.matchAll(/^## (\d+)(?:st|nd|rd|th)-Level Features[ \t]*$/gm)];
if (marks.length !== 10 || marks.some((mark, i) => Number(mark[1]) !== i + 1)) throw new Error('Invalid Summoner level boundaries');
const levels = {};
for (const [i, mark] of marks.entries()) {
  const description = source.slice(mark.index + mark[0].length, marks[i + 1]?.index ?? source.length).trim().replace(/\s*\{data-[^}\n]*\}/g, '');
  levels[String(i + 1)] = { title: mark[0].replace(/^## /, ''), description };
}
const content = source.split('---').slice(2).join('---').trim();
const classIntroduction = content.split('\n## Basics')[0];
const chapterIntroductions = {};
for (const name of ['kits', 'perks', 'complications', 'downtime-projects', 'rewards', 'classes', 'background']) {
  const chapter = readSource(`en/books/heroes/md-linked/chapter/${name}.md`).split('---').slice(2).join('---').trim();
  const heading = /^#{1,6} .+$/m.exec(chapter);
  if (!heading || !chapter.slice(0, heading.index).trim()) throw new Error(`Invalid chapter introduction ${name}`);
  chapterIntroductions[name] = chapter.slice(0, heading.index).trim();
}
const ancestryPath = 'en/books/heroes/md-linked/chapter/ancestries.md';
const ancestry = readSource(ancestryPath).split('---').slice(2).join('---').split('\n### On the Origin of Species')[0].trim();
const sourceDir = path.join(checkout, 'en/books/heroes/md-linked');
const sourceFiles = [];
function walk(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) walk(file);
    else if (file.endsWith('.md')) sourceFiles.push(file);
  }
}
walk(sourceDir);
const normalize = (text) => text.replace(/\[([^\]]+)\]\([^)]*\.md[^)]*\)/g, '$1')
  .replace(/\s*\{data-[^}\n]*\}/g, '').replace(/^#{1,6}\s+/gm, '').trim().replace(/\s+/g, ' ');
const originals = {};
const desiredComposites = new Set([
  'mcdm.heroes.v1/feature.trait.dragon-knight/draconian-pride',
  'mcdm.heroes.v1/feature.trait.dragon-knight/dragon-breath',
  'mcdm.heroes.v1/feature.trait.wode-elf/the-wode-defends',
  'mcdm.heroes.v1/feature.trait.revenant/vengeance-mark',
]);
const compositeBodies = {};
const nestedReferences = {};
for (const file of sourceFiles.sort()) {
  const text = readFileSync(file, 'utf8');
  if (!text.startsWith('---\n')) continue;
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) continue;
  const scc = /^scc:\s*(.+)$/m.exec(text.slice(4, end))?.[1].trim();
  if (!scc) continue;
  const hash = createHash('sha256').update(normalize(text.slice(end + 5))).digest('hex');
  if (originals[scc] && originals[scc] !== hash) throw new Error(`Conflicting SCC files: ${scc}`);
  originals[scc] = hash;
  nestedReferences[scc] = [...text.slice(end + 5).matchAll(/^#{1,6} .*?\{[^\n}]*data-scc="([^"]+)"[^\n}]*\}/gm)].map(match => match[1]);
  if (desiredComposites.has(scc)) {
    const body = text.slice(end + 5).trim();
    const nestedIds = [...body.matchAll(/^#{1,6} .*?\{[^\n}]*data-scc="([^"]+)"[^\n}]*\}/gm)].map(match => match[1]);
    compositeBodies[scc] = { body: body.replace(/\s*\{data-[^}\n]*\}/g, ''), nestedIds };
  }
}
if (Object.keys(compositeBodies).length !== desiredComposites.size) throw new Error('Missing composite source');
const verifiedHeroes = { source: { ...base, path: 'en/books/heroes/md-linked' }, hashes: originals };
for (const [file, data] of [
  ['heroes-source-hashes.json', verifiedHeroes],
  ['chapter-introductions.json', { source: verifiedHeroes.source, introductions: chapterIntroductions }],
  ['heroes-nested-ids.json', { source: verifiedHeroes.source, references: nestedReferences }],
  ['hero-composite-bodies.json', { source: verifiedHeroes.source, bodies: compositeBodies }],
  ['summoner-levels.json', { source: { ...base, path: summonerPath }, levels, classIntroduction }],
  ['ancestry-introduction.json', { source: { ...base, path: ancestryPath }, description: ancestry }],
]) {
  const target = path.join('scripts/originals/reference', file);
  const text = `${JSON.stringify(data, null, 2)}\n`;
  if (check) {
    if (readFileSync(target, 'utf8') !== text) throw new Error(`Snapshot differs: ${target}`);
  } else writeFileSync(target, text);
}
console.log(`SCC snapshots ${check ? 'verified' : 'updated'} at ${revision}`);
