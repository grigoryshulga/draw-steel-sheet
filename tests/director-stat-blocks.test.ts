import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Nodes } from 'mdast';
import { describe, expect, it } from 'vitest';
import { walkJson } from '../scripts/content/lib/common.mjs';
import { remarkDirectorBlocks } from '../src/lib/remark-director-blocks';
import { RuleArticleContent } from '../src/components/rules/RuleArticle';
import { RuleMarkdown } from '../src/components/rules/RuleMarkdown';

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const records = ['monster', 'retainer'].flatMap(kind => walkJson(`content/rules/entities/${kind}`).map(read));
const parser = unified().use(remarkParse).use(remarkGfm);
function visit(node: Nodes, fn: (node: Nodes) => void) {
  fn(node);
  if ('children' in node) node.children.forEach(child => visit(child, fn));
}
function inventory(tree: Nodes) {
  const words: string[] = [], links: string[] = [];
  visit(tree, node => {
    if (node.type === 'link') links.push(node.url);
    if ('value' in node && !(node.type === 'html' && /^<br\s*\/?\s*>$/i.test(node.value))) words.push(...(node.value.match(/[\p{L}\p{N}]+/gu) ?? []));
  });
  return { words: words.sort(), links: links.sort() };
}

describe('Compact creature sheet', () => {
  it('preserves every word, value and link in all 437 monster and retainer stat blocks', () => {
    expect(records).toHaveLength(437);
    for (const record of records) {
      const tree = parser.parse(record.markdown);
      const before = inventory(tree);
      remarkDirectorBlocks()(tree);
      let sheets = 0, fields = 0;
      visit(tree, node => {
        if (node.data?.hProperties?.['data-director-stats']) sheets++;
        if (node.data?.hProperties?.['data-director-slot'] === 'stat') fields++;
      });
      expect(sheets, record.id).toBe(1);
      expect(fields, record.id).toBe(14);
      expect(inventory(tree), record.id).toEqual(before);
    }
  });

  it('groups the name, English subtitle and unit type once, with the page action and stable heading anchor', () => {
    const pack = read('src/generated/rules/articles/monsters.monster.goblin.statblock.goblin-warrior.json');
    const entity = pack.entities[0];
    const html = renderToStaticMarkup(createElement(RuleArticleContent, {
      article: pack.articles[0], entities: Object.fromEntries(pack.entities.map((item: any) => [item.id, item])),
      headingOffset: -1, headingActions: createElement('button', null, 'В закладки'),
    }));
    const header = html.match(/<header class="director-mini-identity">([\s\S]+?)<\/header>/)?.[1] ?? '';
    expect(header).toContain(`<h1 class="rule-entity-name" id="rule-entity-${entity.id}">${entity.name}</h1>`);
    expect(header).toContain('class="director-mini-original" lang="en">Goblin Warrior');
    expect(header).toContain('class="director-mini-type"');
    expect(header).toContain('Орда');
    expect(header).toContain('Налётчик');
    expect(header).toContain('<button>В закладки</button>');
    expect(header).toContain('Боевая ценность');
    expect(html.split('Goblin Warrior')).toHaveLength(2);
    expect(html.match(/class="director-mini-type"/g)).toHaveLength(1);
    expect(html).not.toContain('director-original-name');
    expect(html).not.toMatch(/\bEV\b/);
  });

  it('retains zero and negative values, movement and captain benefits while omitting empty defence rows', () => {
    const text = `| Гуманоид | - | Уровень 1 | Миньон-Налётчик | Боевая ценность 3 за четырёх миньонов |
| --- | --- | --- | --- | --- |
| **1S**<br>Размер | **5**<br>Скорость | **10**<br>Выносливость | **0**<br>Устойчивость | **1**<br>Свободный удар |
| -<br>Иммунитет | Огонь 2<br>Уязвимость | Полёт, лазание<br>Движение | +2 к урону<br>С капитаном | - |
| **-1**<br>Мощь | **+0**<br>Ловкость | **+0**<br>Разум | **+2**<br>Интуиция | **+2**<br>Присутствие |
`;
    const html = renderToStaticMarkup(createElement(RuleMarkdown, { text, articleId: 'monsters.test' }));
    for (const label of ['Боевые показатели', 'Характеристики', 'Особые параметры']) expect(html).toContain(`aria-label="${label}"`);
    for (const value of ['1S', '<strong>0</strong>', '<strong>-1</strong>', '<strong>+0</strong>', '+2 к урону', 'Полёт', 'лазание', 'Огонь 2', 'за четырёх миньонов']) expect(html).toContain(value);
    expect(html).toContain('data-weakness="true"');
    expect(html).not.toContain('Иммунитет');
    expect(html).not.toContain('<table');
  });
});
