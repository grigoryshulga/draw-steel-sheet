import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Nodes } from 'mdast';
import { remarkDirectorBlocks } from '../src/lib/remark-director-blocks';
import { remarkDirectorAbilities } from '../src/lib/remark-director-abilities';
import { RuleMarkdown } from '../src/components/rules/RuleMarkdown';
import { ArticleLanguageScope } from '../src/i18n/locale';
import { RuleArticleContent } from '../src/components/rules/RuleArticle';

const parser = unified().use(remarkParse).use(remarkGfm);
function counts(text: string, language: 'ru' | 'en') {
  const tree = parser.parse(text);
  remarkDirectorBlocks()(tree);
  remarkDirectorAbilities({ language })(tree);
  const result = { sheets: 0, fields: 0, cards: 0, tiers: 0 };
  const walk = (node: Nodes) => {
    const p = node.data?.hProperties;
    if (p?.['data-director-stats']) result.sheets++;
    if (p?.['data-director-slot'] === 'stat') result.fields++;
    if (p?.['data-director-slot'] === 'card') result.cards++;
    if (p?.['data-director-slot'] === 'tier') result.tiers++;
    if ('children' in node) node.children.forEach(walk);
  };
  walk(tree); return result;
}
function inventory(node: Nodes) {
  const words: string[] = [], links: string[] = [];
  const walk = (item: Nodes) => {
    if (item.type === 'link') links.push(item.url);
    if ('value' in item && !(item.type === 'html' && /^<br\s*\/?\s*>$/i.test(item.value))) words.push(...(item.value.match(/[\p{L}\p{N}]+/gu) ?? []));
    if ('children' in item) item.children.forEach(walk);
  };
  walk(node);
  return { words: words.sort(), links: links.sort() };
}
const getPack = (id: string) => JSON.parse(readFileSync(`src/generated/rules/articles/${id}.json`, 'utf8'));

describe('bilingual monster layout', () => {
  it('renders English stat block and cards with source values and actions', () => {
    const entity = getPack('monsters.monster.goblin.statblock.goblin-warrior').entities[0];
    const html = renderToStaticMarkup(createElement(RuleMarkdown, { text: entity.originalDescription, articleId: entity.source.articleId, sourceLocale: 'en' }));
    expect(html).toContain('director-mini-sheet');
    expect(html).toContain('Horde</a> <a');
    expect(html).toContain('Harrier</a>');
    expect(html).toContain('Stamina');
    expect(html).toContain('Spear Charge');
    expect(html).toContain('Crafty');
    expect(html).toContain('sheet-ability-tiers');
    expect(html).not.toContain('<table');
    expect(counts(entity.originalDescription, 'en')).toEqual(counts(entity.markdown, 'ru'));
  });
  it('keeps the same stat header, actions and malice tabs for both article languages', () => {
    const pack = getPack('monsters.monster.goblin.statblock.goblin-warrior');
    const entities = Object.fromEntries(pack.entities.map((entry: { id: string }) => [entry.id, entry]));
    const render = (language: 'ru' | 'en') => renderToStaticMarkup(createElement(ArticleLanguageScope, { language },
      createElement(RuleArticleContent, { article: pack.articles[0], entities, headingActions: createElement('button', null, 'Bookmark') })));
    const ru = render('ru'), en = render('en');
    for (const html of [ru, en]) {
      expect(html.match(/class="director-mini-sheet"/g)).toHaveLength(1);
      expect(html.match(/role="tab"/g)).toHaveLength(2);
      expect(html).toContain('Bookmark');
      expect(html).toContain('sheet-ability-tiers');
    }
    expect(en).toContain('Goblin Warrior');
    expect(en).toContain('Spear Charge');
    expect(en).toContain('Bury the Point');
    expect(en).not.toContain('Атака копьём');
  });
  it('retains weaknesses and negative or zero characteristics in English', () => {
    const entity = getPack('monsters.monster.demon.2nd-echelon.statblock.gunge').entities[0];
    const html = renderToStaticMarkup(createElement(RuleMarkdown, { text: entity.originalDescription, articleId: entity.source.articleId, sourceLocale: 'en' }));
    expect(html).toContain('Holy 5');
    expect(html).toContain('data-weakness="true"');
    expect(html).toContain('<strong>0</strong>');
    expect(html).toContain('<strong>-1</strong>');
    expect(html).toContain('Free triggered action');
  });
  it.each([
    ['monsters.dynamic-terrain.siege-engines.iron-dragon', 'Iron Dragon'],
    ['monsters.rule.monster.malice', 'Malice'],
    ['monsters.monster.group.goblin', 'Goblin'],
  ])('renders standalone English director article %s', (id, sample) => {
    const pack = getPack(id);
    const entities = Object.fromEntries(pack.entities.map((entry: { id: string }) => [entry.id, entry]));
    const html = renderToStaticMarkup(createElement(ArticleLanguageScope, { language: 'en' },
      createElement(RuleArticleContent, { article: pack.articles[0], entities })));
    expect(html).toContain(sample);
    expect(html).not.toContain('href=""');
  });
  it('recognizes every delivered English creature stat block', () => {
    const files = readdirSync('src/generated/rules/articles').filter(file => file.startsWith('monsters.') && file.endsWith('.json'));
    let checked = 0;
    const compared = new Set<string>();
    const differences: string[] = [];
    const missing: string[] = [];
    for (const file of files) {
      const pack = JSON.parse(readFileSync(`src/generated/rules/articles/${file}`, 'utf8'));
      for (const entity of pack.entities) {
        if (!['monster', 'retainer'].includes(entity.kind) || !entity.originalDescription?.trim()) continue;
        const result = counts(entity.originalDescription, 'en');
        if (compared.has(entity.id)) continue;
        compared.add(entity.id);
        checked++;
        const ru = counts(entity.markdown, 'ru');
        if (ru.cards !== result.cards || ru.tiers !== result.tiers) differences.push(`${entity.id}: cards ${ru.cards}/${result.cards}, tiers ${ru.tiers}/${result.tiers}`);
        if (result.sheets !== 1 || result.fields !== 14) missing.push(`${entity.id}: ${result.sheets}/${result.fields}`);
      }
    }
    expect(checked).toBeGreaterThan(400);
    expect(missing).toEqual([]);
    expect(differences).toEqual([]);
  }, 30000);
  it('preserves every icon-marked English ability across director packs', () => {
    const files = readdirSync('src/generated/rules/articles').filter(file => file.startsWith('monsters.') && file.endsWith('.json'));
    const seen = new Set<string>();
    const missing: string[] = [];
    for (const file of files) {
      const pack = JSON.parse(readFileSync(`src/generated/rules/articles/${file}`, 'utf8'));
      for (const entity of pack.entities) {
        if (!entity.director || !entity.originalDescription?.trim() || seen.has(entity.id)) continue;
        seen.add(entity.id);
        const expected = (entity.originalDescription.match(/^(?:>\s*)?[🗡🏹⭐️❗️☠️🔳❇️👤🌀⚔️❕]+\s+\*\*/gmu) ?? []).length;
        const actual = counts(entity.originalDescription, 'en').cards;
        const tree = parser.parse(entity.originalDescription);
        const before = inventory(tree);
        remarkDirectorBlocks()(tree);
        remarkDirectorAbilities({ language: 'en' })(tree);
        expect(inventory(tree), entity.id).toEqual(before);
        if (expected !== actual) missing.push(`${entity.id}: ${actual}/${expected}`);
      }
    }
    expect(seen.size).toBe(658);
    expect(missing).toEqual([]);
  }, 30000);

});
