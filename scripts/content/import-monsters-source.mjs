#!/usr/bin/env node
/** Pin the Monsters book only. Translation and normal builds need no checkout/network. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkJson } from './lib/common.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/content/import-monsters-source.mjs <data-unified checkout>');
const glossary = JSON.parse(readFileSync(path.join(root, 'content/monsters/glossary.json'), 'utf8'));
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== glossary.sourceRevision) throw new Error(`Source revision differs from glossary: ${revision}`);
const sourceRoot = path.join(source, 'en/books/monsters');
const records = walkJson(path.join(sourceRoot, 'json')).map(file => {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const relativePath = path.relative(path.join(sourceRoot, 'json'), file).replaceAll(path.sep, '/');
  const originalId = data.scc ?? data.metadata?.scc;
  if (!originalId?.startsWith('mcdm.monsters.v1/')) throw new Error(`Unexpected source: ${relativePath}`);
  const id = originalId.replace('mcdm.monsters.v1/', '').replaceAll('/', '.');
  const markdown = readFileSync(path.join(sourceRoot, 'md', relativePath.replace(/\.json$/, '.md')), 'utf8')
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  const section = data.type === 'dynamic-terrain' || relativePath === 'chapter/dynamic-terrain.json' ? 'terrain'
    : relativePath.startsWith('monster/retainer/') || relativePath === 'chapter/retainers.json' ? 'retainers'
    : relativePath.startsWith('rule/') || relativePath === 'chapter/monster-basics.json' ? 'rules' : 'monsters';
  const groupSlug = relativePath.startsWith('monster/group/') ? data.category
    : relativePath.startsWith('monster/') ? relativePath.split('/')[1]
    : relativePath.startsWith('dynamic-terrain/') ? relativePath.split('/')[1] : '';
  const kind = data.type === 'chapter' ? null : data.type === 'statblock' ? section === 'retainers' ? 'retainer' : 'monster'
    : data.type === 'dynamic-terrain' ? 'terrain' : data.type === 'featureblock' ? 'monster-feature'
    : data.type === 'rule' ? 'monster-rule' : 'monster-lore';
  const stats = {};
  for (const key of ['level', 'ev', 'role', 'organization', 'keywords', 'size', 'speed', 'stamina', 'stability', 'free_strike', 'might', 'agility', 'reason', 'intuition', 'presence', 'movement', 'terrain_type']) {
    if (data[key] !== undefined) stats[key] = data[key];
  }
  if (data.stats) stats.terrainStats = data.stats;
  return { sourcePath: relativePath, id, articleId: `monsters.${id}`, originalId, originalName: data.name,
    sourceType: data.type, kind, section, groupSlug, stats, markdown,
    sourceHash: createHash('sha256').update(readFileSync(file)).digest('hex') };
}).sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'en'));
if (records.length !== 662 || new Set(records.map(r => r.id)).size !== records.length) throw new Error('Unexpected source inventory');
const output = { schemaVersion: 1, repository: glossary.sourceRepository, revision, book: 'monsters', records };
mkdirSync(path.join(root, 'content/monsters'), { recursive: true });
writeFileSync(path.join(root, 'content/monsters/source.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`Pinned ${records.length} Monsters records at ${revision}`);
