import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { loadEnglishArticleTitles } from '../src/rules/repository';

type Article = { id: string; originalName?: string; originalDescription?: string; englishEdition?: { title: string } };

it('verifies a table feature without including the following subclass feature', () => {
  const pack = JSON.parse(readFileSync('src/generated/rules/articles/0801.json', 'utf8'));
  const feature = pack.entities.find((entity: { id: string }) => entity.id === 'feature.fury.level-1.1st-level-aspect-features');
  expect(feature.originalCoverage.status).toBe('complete');
  expect(feature.originalDescription).toContain('1st-Level Aspect Features Table');
  expect(feature.originalDescription).toContain('Relentless Hunter');
  expect(feature.originalDescription).not.toContain('You can use and gain the benefits of a stormwight kit');
});

it('delivers complete bounded originals for resource rules and aggregates', () => {
  const pack = JSON.parse(readFileSync('src/generated/rules/articles/0801.json', 'utf8'));
  const get = (id: string) => pack.entities.find((entity: { id: string }) => entity.id === id);
  const combat = get('feature.fury.level-1.ferocity-in-combat');
  expect(combat.originalCoverage.status).toBe('complete');
  expect(combat.originalDescription).toContain('You lose any remaining ferocity at the end of the encounter.');
  expect(combat.originalDescription).not.toContain('Though you can\'t gain ferocity outside of combat');
  const introduction = get('feature.fury.level-2.2nd-level-aspect-ability');
  // The next level is delivered separately; check it in its own article below.
  expect(introduction).toBeUndefined();
  const levelTwo = JSON.parse(readFileSync('src/generated/rules/articles/0802.json', 'utf8'));
  const ability = levelTwo.entities.find((entity: { id: string }) => entity.id === 'feature.fury.level-2.2nd-level-aspect-ability');
  expect(ability.originalCoverage.status).toBe('complete');
  expect(ability.originalDescription).not.toContain('2nd-Level Berserker Ability');
  const ancestry = JSON.parse(readFileSync('src/generated/rules/articles/0402.json', 'utf8')).entities.find((entity: { id: string }) => entity.id === 'ancestry.devil');
  expect(ancestry.originalCoverage.status).toBe('complete');
  expect(ancestry.originalDescription).toContain('## Devil Traits');
  expect(ancestry.originalDescription).not.toContain('Signature Trait: Silver Tongue');
  const classes = JSON.parse(readFileSync('src/generated/rules/packs/chapter-08-neistovyy.json', 'utf8'));
  const fury = classes.entities.find((entity: { id: string }) => entity.id === 'class.fury');
  expect(fury.originalCoverage.status).toBe('complete');
  expect(fury.originalDescription).toContain('## 1st-Level Features');
  expect(fury.originalDescription).not.toContain('## 2nd-Level Features');
});

describe('delivered English article titles', () => {
  it('matches every delivered article title and omits missing originals', async () => {
    const directory = 'src/generated/rules/packs';
    const articles: Article[] = readdirSync(directory)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')).articles);
    const expected = Object.fromEntries(articles
      .filter((article) => (article.englishEdition?.title ?? article.originalName)?.trim())
      .map((article) => [article.id, article.englishEdition?.title ?? article.originalName]));
    const titles = await loadEnglishArticleTitles();
    expect(titles).toEqual(expected);
    expect(titles['0101']).toBeTruthy();
    expect(titles['0414']).toBe('Tauros'); // Editorial edition; not presented as an original.
  });
});

it('links exactly the available glossary entries to verbatim definitions in the English book', async () => {
  const { CANONICAL_GLOSSARY, loadGlossaryDefinitions } = await import('../src/rules/consumer-library');
  const definitions = await loadGlossaryDefinitions();
  const source = JSON.parse(readFileSync('src/generated/rules/articles/0102.json', 'utf8')).articles[0].originalDescription;
  expect(Object.keys(definitions).sort()).toEqual(CANONICAL_GLOSSARY.filter(entry => entry.hasEnglishDefinition).map(entry => entry.id).sort());
  expect(definitions['glossary.adjacent']).toBe('Within 1 square.');
  expect(source).toContain(definitions['glossary.adjacent']);
  expect(definitions['glossary.villain-actions']).toContain('villain');
  expect(definitions['glossary.summoner']).toContain('You are the armada');
  expect(CANONICAL_GLOSSARY.filter(entry => !entry.hasEnglishDefinition)).toHaveLength(0);
});

it('delivers audited prose sections in source order without the next section', () => {
  const article = JSON.parse(readFileSync('src/generated/rules/articles/0101.json', 'utf8')).articles[0];
  const sections = JSON.parse(readFileSync('scripts/originals/reference/codex-sections.json', 'utf8'));
  const english: string = article.originalDescription;
  let previous = -1;
  for (let index = 2295; index <= 2300; index++) {
    const source = sections[index];
    const position = english.indexOf(source.description.slice(0, 80));
    expect(position).toBeGreaterThan(previous);
    previous = position;
    if (index > 2295) expect(english).toContain(`## ${source.name}`);
  }
  expect(english).not.toContain(sections[2301].description.slice(0, 80));
  expect(article.blocks.every((block: { type: string }) => block.type === 'markdown')).toBe(true);
});

it('assembles only explicitly audited prose descendants for all mapped articles', () => {
  const maps = JSON.parse(readFileSync('scripts/originals/maps/prose-sections.json', 'utf8'));
  const sources = JSON.parse(readFileSync('scripts/originals/reference/codex-sections.json', 'utf8'));
  expect(Object.keys(maps)).toHaveLength(40);
  for (const [id, mapping] of Object.entries(maps) as [string, { index: number; sections: { index: number; name: string; level: number }[]; level: number }][]) {
    const article = JSON.parse(readFileSync(`src/generated/rules/articles/${id}.json`, 'utf8')).articles[0];
    expect(article.blocks.every((block: { type: string }) => block.type === 'markdown'), id).toBe(true);
    let position = -1;
    for (const section of mapping.sections) {
      const heading = `${'#'.repeat(Math.min(6, section.level - mapping.level + 1))} ${section.name}`;
      const next = article.originalDescription.indexOf(heading, position + 1);
      expect(next, `${id}: ${section.name}`).toBeGreaterThan(position);
      position = next;
    }
    const after = sources[mapping.index + mapping.sections.length + 1];
    if (after?.description?.length >= 80) expect(article.originalDescription, id).not.toContain(after.description.slice(0, 80));
  }
});

it('delivers all Summoner levels and marks the remaining placeholders honestly', () => {
  for (let level = 1; level <= 10; level++) {
    const id = String(820 + level).padStart(4, '0');
    const article = JSON.parse(readFileSync(`src/generated/rules/articles/${id}.json`, 'utf8')).articles[0];
    expect(article.blocks).toEqual([]);
    expect(article.originalName).toMatch(new RegExp(`^${level}(?:st|nd|rd|th)-Level Features$`));
    expect(article.originalDescription.length).toBeGreaterThan(200);
    expect(article.originalDescription).not.toMatch(new RegExp(`^## ${level + 1}(?:st|nd|rd|th)-Level Features$`, 'm'));
    expect(article.originalCoverage.status).toBe('complete');
  }
  const homebrew = JSON.parse(readFileSync('src/generated/rules/articles/0414.json', 'utf8')).articles[0];
  expect(homebrew.originalCoverage).toEqual({ status: 'missing', reason: 'homebrew' });
  const editorial = JSON.parse(readFileSync('src/generated/rules/articles/2101.json', 'utf8')).articles[0];
  expect(editorial.originalCoverage).toEqual({ status: 'missing', reason: 'editorial' });
});

it('keeps editorial English separate from originals and indexes its title and text', () => {
  const input = JSON.parse(readFileSync('content/english-editions.json', 'utf8'));
  const titles = JSON.parse(readFileSync('src/generated/rules/english-titles.json', 'utf8'));
  const index = JSON.parse(readFileSync('src/generated/rules/search-en.json', 'utf8'));
  expect(Object.keys(input.articles)).toHaveLength(6);
  expect(Object.keys(input.entities)).toHaveLength(17);
  for (const [id, edition] of Object.entries(input.articles) as [string, { title: string; blocks: unknown[] }][]) {
    const article = JSON.parse(readFileSync(`src/generated/rules/articles/${id}.json`, 'utf8')).articles[0];
    expect(article.englishEdition).toEqual(edition);
    expect(article.originalDescription).toBeFalsy();
    expect(article.originalCoverage.status).toBe('missing');
    expect(titles[id]).toBe(edition.title);
    expect(index.articles.find((item: { id: string }) => item.id === id)?.text).toContain(edition.title);
  }
});

it('has an original or editorial text for each visible non-leading prose block', () => {
  const directory = 'src/generated/rules/articles';
  for (const file of readdirSync(directory).filter(file => file.endsWith('.json'))) {
    const pack = JSON.parse(readFileSync(`${directory}/${file}`, 'utf8'));
    const article = pack.articles[0];
    if (article.englishEdition) continue;
    const refs = new Set(pack.entities.map((entity: { id: string }) => entity.id));
    const lead = article.blocks.findIndex((block: { type: string; text?: string; ref?: string }) =>
      block.type === 'markdown' ? block.text?.trim() : refs.has(block.ref));
    article.blocks.forEach((block: { type: string; text?: string; originalText?: string }, i: number) => {
      if (block.type !== 'markdown' || !/[А-Яа-яЁё]/.test(block.text ?? '')) return;
      expect(Boolean(block.originalText || (i === lead && article.originalDescription)), `${article.id}:${i}`).toBe(true);
    });
  }
});

it('reconstructs complete official class level sections in source order without duplicate blocks', () => {
  const sources = JSON.parse(readFileSync('scripts/originals/reference/codex-sections.json', 'utf8'));
  const maps = JSON.parse(readFileSync('scripts/originals/maps/class-levels.json', 'utf8'));
  expect(Object.keys(maps)).toHaveLength(90);
  for (const id of ['0801', '0811', '0834', '0898']) {
    const pack = JSON.parse(readFileSync(`src/generated/rules/articles/${id}.json`, 'utf8'));
    const article = pack.articles[0];
    const mapping = maps[id];
    expect(article.englishEdition.kind).toBe('source');
    expect(article.originalCoverage.status).toBe('complete');
    const blocks = article.englishEdition.blocks;
    const descendants = blocks.slice(sources[mapping.index].description.trim() ? 1 : 0);
    expect(descendants).toHaveLength(mapping.sections.length);
    const byId = new Map(pack.entities.map((entity: { id: string; originalId?: string }) => [entity.id, entity]));
    mapping.sections.forEach((section: { name: string; scc: string }, index: number) => {
      const block = descendants[index];
      if (block.type === 'entity') expect((byId.get(block.ref) as { originalId: string }).originalId).toBe(section.scc);
      else expect(block.text).toContain(section.name);
    });
  }
});

it('proves Monsters source coverage using the pinned full-text snapshot', () => {
  const snapshot = JSON.parse(readFileSync('content/monsters/source.json', 'utf8'));
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ');
  let verified = 0;
  for (const record of snapshot.records) {
    const file = `src/generated/rules/articles/${record.articleId}.json`;
    const article = JSON.parse(readFileSync(file, 'utf8')).articles[0];
    expect(normalize(article.originalDescription), record.articleId).toBe(normalize(record.markdown));
    expect(article.originalCoverage.status).toBe('complete');
    verified++;
  }
  expect(verified).toBe(662);
});

it('keeps the complication table edition difference explicit', () => {
  const article = JSON.parse(readFileSync('src/generated/rules/articles/1102.json', 'utf8')).articles[0];
  expect(article.originalCoverage).toEqual({ status: 'excerpt', reason: 'table-order-differs' });
  expect(article.blocks[0].text).toContain('Аварийная посадка');
  expect(article.originalDescription).toContain('Advanced Studies');
});
