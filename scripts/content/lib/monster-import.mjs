/** Shared authoring helper. Translated canonical files are the editable inputs, never build output. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const MONSTER_CHAPTERS = {
  rules: { dir: '22-monster-rules', title: '22. Монстры: правила ведущего', group: 'Правила ведущего' },
  monsters: { dir: '23-monsters', title: '23. Бестиарий', group: 'Бестиарий' },
  retainers: { dir: '24-retainers', title: '24. Помощники', group: 'Помощники' },
  terrain: { dir: '25-terrain', title: '25. Динамическая местность', group: 'Динамическая местность' },
};

/** Numeric tokens exclude link destinations and frontmatter. Useful for translation audits. */
export function numericTokens(markdown) {
  return markdown.replace(/\]\([^)]*\)/g, ']').match(/(?<![\p{L}\p{N}])[-+−]?\d+(?:[.,]\d+)?(?:d\d+)?[SML]?(?![\p{L}\p{N}])/gu) ?? [];
}

export function writeMonsterTranslation(sourcePath, translation, { root = defaultRoot } = {}) {
  const source = JSON.parse(readFileSync(path.join(root, 'content/monsters/source.json'), 'utf8'));
  const record = source.records.find(item => item.sourcePath === sourcePath);
  if (!record) throw new Error(`Unknown Monsters source: ${sourcePath}`);
  const { name, markdown } = translation;
  if (!name?.trim() || !markdown?.trim() || !/[А-Яа-яЁё]/u.test(name) || !/[А-Яа-яЁё]/u.test(markdown)) {
    throw new Error(`Expected complete Russian name and markdown: ${sourcePath}`);
  }
  const glossary = JSON.parse(readFileSync(path.join(root, 'content/monsters/glossary.json'), 'utf8'));
  const chapter = MONSTER_CHAPTERS[record.section];
  const translated = en => [...glossary.terms, ...glossary.core, ...glossary.names].find(term => term.en.toLowerCase() === en?.toLowerCase())?.ru ?? en;
  const group = glossary.groups.find(item => item.slug === record.groupSlug)?.ru
    ?? ({ 'environmental-hazards': 'Природные опасности', fieldworks: 'Полевые укрепления', mechanisms: 'Механизмы',
      'siege-engines': 'Осадные орудия', 'power-fixtures': 'Источники силы', 'supernatural-objects': 'Сверхъестественные объекты' })[record.groupSlug]
    ?? chapter.group;
  const articlePath = `Monsters/${record.sourcePath.replace(/\.json$/, '.md')}`;
  const original = { originalId: record.originalId, originalName: record.originalName, originalDescription: record.markdown };
  const plain = text => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*+/g, '').trim();
  // Terrain prices and sizes can be prose (cost per area, difficult terrain).
  // Their display values must come from the translated stat list.
  const terrainStat = field => {
    if (!record.stats.terrainStats?.some(stat => stat.name === field)) return undefined;
    const label = field === 'Size' ? 'Размер' : field === 'EV' ? 'БЦ' : field;
    const value = markdown.match(new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'm'))?.[1];
    if (!value) throw new Error(`Missing translated terrain ${field}: ${sourcePath}`);
    return plain(value);
  };
  const ev = record.stats.ev ?? terrainStat('EV');
  const sourceSize = record.stats.size ?? terrainStat('Size');
  const size = typeof sourceSize === 'string' ? sourceSize.replace(/ or /g, ' или ') : sourceSize;
  const keywords = (record.stats.keywords ?? []).map(en => {
    const term = glossary.keywords.find(term => term.en === en);
    if (!term) throw new Error(`Missing keyword translation: ${en}`);
    return term.ru;
  });
  const director = { section: record.section, sourcePath: record.sourcePath, sourceRevision: source.revision,
    groupSlug: record.groupSlug, recordType: record.sourceType,
    ...(record.stats.level !== undefined ? { level: record.stats.level } : {}),
    ...(ev !== undefined ? { ev: String(ev) } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(record.stats.role ? { role: translated(record.stats.role) } : {}),
    ...(record.stats.organization ? { organization: translated(record.stats.organization) } : {}),
    ...(record.stats.terrain_type ? { organization: translated(record.stats.terrain_type) } : {}) };
  const article = { id: record.articleId, title: name.trim(), chapter: chapter.title, group, path: articlePath, ...original, director,
    blocks: record.kind ? [{ type: 'entity', ref: record.id }] : [{ type: 'markdown', text: markdown.trim() + '\n' }] };
  const output = (file, data) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  };
  if (record.kind) {
    const entity = { id: record.id, kind: record.kind, name: name.trim(), markdown: markdown.trim() + '\n',
      source: { articleId: record.articleId, path: articlePath }, ...original, director };
    output(path.join(root, 'content/rules/entities', record.kind, 'monsters', `${record.id}.json`), entity);
  }
  output(path.join(root, 'content/rules/articles', chapter.dir, `${record.articleId}.json`), article);
  return { articleId: record.articleId, entityId: record.kind ? record.id : null };
}
