import { bookIndex, codexArticleHref } from "../src/rules/codex-navigation";
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { walkJson } from '../scripts/content/lib/common.mjs';
import { numericTokens } from '../scripts/content/lib/monster-import.mjs';
import { catalogSectionEntries } from '../src/data/reference-catalog';
import { emptyDirectorFilters, matchesDirectorFilters } from '../src/lib/director-catalog';
import { RuleArticleContent } from '../src/components/rules/RuleArticle';
import { createRuleSearcher } from '../src/rules/search';

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const source = read('content/monsters/source.json');
const manifest = read('src/generated/rules/manifest.json');
const search = read('src/generated/rules/search.json');
const glossary = read('src/generated/consumers/library.json').glossary;
const lexicon = read('content/monsters/glossary.json');
const articles = walkJson('content/rules/articles').map(read);
const entities = new Map(walkJson('content/rules/entities').map(read).map((entity: any) => [entity.id, entity]));
const articleById = new Map(articles.map((article: any) => [article.id, article]));
const delivery = (id: string) => read(path.join('src/generated/rules/articles', `${id}.json`));

describe('Monsters book delivery', () => {
  it('shows creature tabs with one stat header and no repeated group Malice introduction', () => {
    const pack = delivery('monsters.monster.angulotl.statblock.angulotl-slink');
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article: pack.articles[0], entities: Object.fromEntries(pack.entities.map((entity: any) => [entity.id, entity])) }));
    expect(html.match(/class="director-mini-sheet"/g)).toHaveLength(1);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    const panels = html.split('role="tabpanel"');
    expect(panels).toHaveLength(3);
    expect(panels[1]).toContain('Удар языком');
    expect(panels[1]).not.toContain('Стоимость: 2 Раздора');
    expect(panels[2]).toContain('hidden=""');
    expect(panels[2]).toContain('Стоимость: 2 Раздора');
    expect(panels[2]).not.toContain('Angulotl Malice');
    expect(panels[2]).not.toContain('В начале хода любого ангулотла');
  });

  it('includes group Malice, eligible lower echelons and only the matching dragon rules', () => {
    const maliceIds = (id: string) => delivery(id).entities.filter((entity: any) => entity.kind === 'monster-feature' && entity.id.includes('malice')).map((entity: any) => entity.id);
    expect(maliceIds('monsters.monster.goblin.statblock.goblin-warrior')).toEqual(['monster.goblin.goblin-malice']);
    for (const group of ['demon', 'undead', 'war-dog']) {
      for (const level of [1, 4, 7, 10]) {
        const creature = manifest.articles.find((entry: any) => entry.director?.groupSlug === group && entry.director.recordType === 'statblock' && entry.director.level === level);
        expect(creature).toBeDefined();
        const ids = maliceIds(creature.id);
        expect(ids).toHaveLength([1, 4, 7, 10].filter(minimum => minimum <= level).length);
        for (const minimum of [1, 4, 7, 10]) expect(ids.some((id: string) => id.includes(`level-${minimum}-`))).toBe(minimum <= level);
      }
    }
    for (const dragon of ['thorn', 'gloom', 'crucible', 'omen', 'meteor']) {
      expect(maliceIds(`monsters.monster.dragon.statblock.${dragon}-dragon`)).toEqual([`monster.dragon.${dragon}-dragon-malice`]);
    }
    expect(maliceIds('monsters.monster.retainer.statblock.goblin-guide')).toEqual([]);
  });

  it('publishes all 37 short definitions in the glossary with full text and working redirects', () => {
    const definitions = manifest.articles.filter((entry: any) => entry.director?.glossaryId);
    expect(definitions).toHaveLength(37);
    const fullGlossary = read('src/generated/consumers/library.json').glossary;
    for (const entry of definitions) {
      const term = fullGlossary.find((term: any) => term.id === entry.director.glossaryId);
      const pack = delivery(entry.id);
      expect(term.markdown.trim(), entry.id).toBe(pack.entities[0].markdown.trim());
      expect(term.markdown).not.toContain('Полные правила в Кодексе');
      expect(bookIndex.some(item => item.id === entry.id)).toBe(false);
      expect(codexArticleHref(entry.id)).toBe(`#/catalog/glossary#term-${term.id}`);
    }
    for (const name of ['malice', 'villain-action', 'creature-free-strike', 'captain']) {
      expect(bookIndex.some(item => item.id === `monsters.rule.monster.${name}`)).toBe(true);
    }
  });

  it('keeps rules and lore in the book and routes every stat block to Reference', () => {
    const sheets = manifest.articles.filter((entry: any) => ['statblock', 'dynamic-terrain'].includes(entry.director?.recordType));
    expect(sheets).toHaveLength(472);
    for (const entry of sheets) {
      expect(bookIndex.some(item => item.id === entry.id)).toBe(false);
      expect(codexArticleHref(entry.id)).toBe(`#/catalog/${entry.director.section}/${entry.id}`);
    }
    const lore = delivery('monsters.monster.group.angulotl');
    expect(bookIndex.some(item => item.id === lore.articles[0].id)).toBe(true);
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article: lore.articles[0], entities: Object.fromEntries(lore.entities.map((item: any) => [item.id, item])) }));
    expect(html).toContain('#/catalog/monsters/group:angulotl');
    expect(html).toContain('#/catalog/monsters/monsters.monster.angulotl.statblock.angulotl-slink');
    expect(html).not.toContain('#/codex/monsters.monster.angulotl.statblock.angulotl-slink');
  });

  it('covers all 662 pinned records once with full Russian text, original identity and every numeric token', () => {
    expect(source.records).toHaveLength(662);
    expect(new Set(source.records.map((r: any) => r.originalId)).size).toBe(662);
    expect(source.records.filter((r: any) => r.kind === 'monster')).toHaveLength(416);
    expect(source.records.filter((r: any) => r.kind === 'retainer')).toHaveLength(21);
    expect(source.records.filter((r: any) => r.kind === 'terrain')).toHaveLength(35);
    for (const record of source.records) {
      const article: any = articleById.get(record.articleId);
      expect(article, record.sourcePath).toBeDefined();
      expect(article.originalId).toBe(record.originalId);
      expect(article.originalId).toMatch(/^mcdm\.monsters\.v1\//);
      expect(article.originalDescription).toBe(record.markdown);
      expect(article.title).toMatch(/[А-Яа-яЁё]/);
      const entity: any = record.kind ? entities.get(record.id) : undefined;
      const translated = entity?.markdown ?? article.blocks.map((block: any) => block.text).join('');
      expect(translated, record.sourcePath).not.toMatch(/\bEV\b/);
      expect(numericTokens(translated), record.sourcePath).toEqual(numericTokens(record.markdown));
      // Full prose is usually longer in Russian. This detects truncation/stubs,
      // alongside exact numeric and link sequence comparisons.
      const visibleLength = (text: string) => text.replace(/\]\([^)]+\)/g, ']').replace(/\s+/g, ' ').length;
      expect(visibleLength(translated), record.sourcePath).toBeGreaterThan(visibleLength(record.markdown) * 0.65);
      // Russian grammar can reorder linked terms within a sentence; preserve
      // the complete multiset, including repeated references.
      expect((translated.match(/scc\.v1:[^)]+/g) ?? []).sort(), record.sourcePath).toEqual((record.markdown.match(/scc\.v1:[^)]+/g) ?? []).sort());
      expect(article.director.sourceRevision).toBe(source.revision);
    }
  });

  it('resolves every source link and reconstructs the full searchable delivery, including progression', () => {
    const ids = new Set(manifest.articles.map((article: any) => article.id));
    const glossaryIds = new Set(glossary.map((term: any) => term.id));
    for (const entry of manifest.articles.filter((entry: any) => entry.director)) {
      const pack = delivery(entry.id);
      const article = pack.articles[0];
      const byId = new Map(pack.entities.map((entity: any) => [entity.id, entity]));
      const text = article.blocks.map((block: any) => block.type === 'markdown' ? block.text : (byId.get(block.ref) as any).markdown).join('');
      expect(text, entry.id).not.toContain('scc.v1:');
      for (const match of text.matchAll(/\]\(#\/codex\/([^)/]+)(?:\/[^)]*)?\)/g)) expect(ids.has(match[1]), match[1]).toBe(true);
      for (const match of text.matchAll(/#\/catalog\/glossary#term-([^)]*)/g)) expect(glossaryIds.has(decodeURIComponent(match[1])), match[1]).toBe(true);
      const expected = `${article.title} ${article.group} ${article.originalName ?? ''} ${text}`.replace(/\s+/g, ' ').trim();
      expect(search.articles.find((d: any) => d.id === entry.id)?.text, entry.id).toBe(expected);
      for (const related of article.related ?? []) expect(ids.has(related.id)).toBe(true);
    }
  });

  it('loads a retainer together with its own and its role advancement, and links the advancement table', () => {
    const pack = delivery('monsters.monster.retainer.statblock.goblin-guide');
    const refs = pack.articles[0].blocks.filter((block: any) => block.type === 'entity').map((block: any) => block.ref);
    expect(refs).toEqual([
      'monster.retainer.statblock.goblin-guide',
      'monster.retainer.advancement-features.goblin-guide',
      'monster.retainer.role-advancement.harrier',
    ]);
    expect(pack.entities.map((entity: any) => entity.id)).toEqual(refs);
    expect(pack.articles[0].related.map((item: any) => item.id)).toContain('monsters.guide.retainer-advancement');
  });

  it('finds Russian and English monster names and combines role, size, level, EV and keyword filters', () => {
    const entries = catalogSectionEntries('monsters');
    expect(entries.every(entry => !/\bEV\b/.test(entry.summary))).toBe(true);
    expect(entries.find(entry => entry.id.endsWith('.goblin-warrior'))?.summary).toContain('БЦ 3');
    const filters = { ...emptyDirectorFilters, query: 'goblin warrior', role: 'Налётчик', minLevel: '1', maxLevel: '1', minEv: '3', maxEv: '3', size: '1S', keyword: 'Гуманоид' };
    expect(entries.filter(entry => matchesDirectorFilters(entry, filters)).map(entry => entry.id)).toEqual(['monsters.monster.goblin.statblock.goblin-warrior']);
    expect(entries.filter(entry => matchesDirectorFilters(entry, { ...filters, minEv: '4' }))).toEqual([]);
    expect(entries.some(entry => matchesDirectorFilters(entry, { ...emptyDirectorFilters, query: 'гоблин воин' }))).toBe(true);
    const finder = createRuleSearcher(manifest.articles, search);
    expect(finder.search('Goblin Warrior').map(result => result.entry.id)).toContain('monsters.monster.goblin.statblock.goblin-warrior');
  });

  it('uses one glossary spelling per keyword and preserves terrain prices per area in Russian', () => {
    const keywords = new Map(lexicon.keywords.map((term: any) => [term.en, term.ru]));
    for (const record of source.records.filter((record: any) => record.stats.keywords)) {
      const entry = manifest.articles.find((entry: any) => entry.id === record.articleId);
      expect(entry.director.keywords, record.sourcePath).toEqual(record.stats.keywords.map((word: string) => keywords.get(word)));
    }
    const pond = catalogSectionEntries('terrain').find(entry => entry.id.endsWith('.frozen-pond'))!;
    expect(pond.director?.ev).toBe('1 за пруд 10 x 10');
    expect(pond.director?.size).toBe('Одна или несколько клеток труднопроходимой местности');
    expect(matchesDirectorFilters(pond, { ...emptyDirectorFilters, minEv: '1', maxEv: '1' })).toBe(true);
    expect(matchesDirectorFilters(pond, { ...emptyDirectorFilters, minEv: '2' })).toBe(false);
    const noPrice = catalogSectionEntries('retainers').find(entry => entry.director?.ev === '-')!;
    expect(matchesDirectorFilters(noPrice, { ...emptyDirectorFilters, minEv: '0' })).toBe(false);
  });

  it('renders stat facts, complete ability cards and live related links without raw HTML fragments', () => {
    const pack = delivery('monsters.monster.goblin.statblock.goblin-warrior');
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article: pack.articles[0], entities: Object.fromEntries(pack.entities.map((entity: any) => [entity.id, entity])) }));
    expect(html).toContain('director-mini-sheet');
    expect(html).toContain('sheet-ability-card is-full director-ability');
    expect(html).toContain('Бросок силы');
    expect(html).toContain('monsters.monster.goblin.goblin-malice');
    expect(html).not.toContain('&lt;br&gt;');
    expect(html).not.toContain('scc.v1:');
    expect(html).not.toContain('Правило не загружено');
  });
});
