import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Nodes, Blockquote } from 'mdast';
import { describe, expect, it } from 'vitest';
import { walkJson } from '../scripts/content/lib/common.mjs';
import { remarkDirectorAbilities } from '../src/lib/remark-director-abilities';
import { RuleMarkdown } from '../src/components/rules/RuleMarkdown';
import { AbilityGroup } from '../src/components/rules/AbilityGroup';

const parser = unified().use(remarkParse).use(remarkGfm);
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const records = walkJson('content/rules/entities').map(read).filter((entity: any) => entity.director);
const render = (text: string) => renderToStaticMarkup(createElement(RuleMarkdown, { text, articleId: 'monsters.test' }));
function walk(node: Nodes, fn: (node: Nodes) => void) {
  fn(node);
  if ('children' in node) node.children.forEach(child => walk(child, fn));
}
function links(node: Nodes) {
  const result: string[] = [];
  walk(node, child => { if (child.type === 'link') result.push(child.url); });
  return result.sort();
}
function words(tree: Nodes) {
  const result: string[] = [];
  walk(tree, node => { if ('value' in node) result.push(...(node.value.match(/[\p{L}\p{N}]+/gu) ?? [])); });
  return result.sort();
}
const visibleText = (html: string) => html.replace(/<span class="rule-tip"[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '');

describe('Monsters abilities use shared cards', () => {
  it('covers every icon-marked block in the entire book without losing words, numbers or authored links', () => {
    let cards = 0, expected = 0;
    const missing: string[] = [];
    for (const record of records) {
      const tree = parser.parse(record.markdown);
      const before = words(tree);
      const destinations = links(tree);
      // Independent source inventory: every icon-prefixed ability heading.
      const count = (record.markdown.match(/^(?:>\s*)?[🗡🏹⭐️❗️☠️🔳❇️👤🌀⚔️❕]+\s+\*\*/gmu) ?? []).length;
      expected += count;
      remarkDirectorAbilities()(tree);
      let found = 0;
      let grouped = 0;
      walk(tree, node => {
        if (node.data?.hProperties?.['data-director-slot'] === 'card') found++;
        if (node.data?.hProperties?.['data-director-slot'] === 'ability-group' && 'children' in node) {
          expect(node.children.length, record.id).toBeGreaterThan(0);
          for (const child of node.children) expect(child.data?.hProperties?.['data-director-slot'], record.id).toBe('card');
          grouped += node.children.length;
        }
      });
      expect(grouped, record.id).toBe(found);
      if (found !== count) missing.push(`${record.id}: ${found} / ${count}`);
      cards += found;
      expect(words(tree), record.id).toEqual(before);
      expect(links(tree), record.id).toEqual(destinations);
    }
    expect(missing).toEqual([]);
    expect(cards).toBe(expected);
    expect(cards).toBeGreaterThan(2200);
  }, 20_000); // Full-book integrity audit; allow slower CI runners, as in codex-abilities.test.ts.

  it('shows signature and triggered actions, cost, fixed damage and linked effects with shared components', () => {
    const pack = read('src/generated/rules/articles/monsters.monster.goblin.statblock.goblin-warrior.json');
    const html = render(pack.entities[0].markdown);
    expect(html.match(/class="sheet-ability-card is-full director-ability"/g)).toHaveLength(3);
    expect(html).toContain('card-header sheet-ability-card-head card-band');
    expect(html).toContain('data-action="main"');
    expect(html).toContain('data-action="passive"');
    expect(html).toContain('data-kind="signature"');
    expect(html).toContain('Стоимость: 2 Раздора');
    expect(html).toContain('sheet-ability-meta');
    expect(html).toContain('sheet-ability-tiers');
    expect(html).toContain('damage-chip');
    expect(html).toContain('href="#/catalog/glossary#term-glossary.bleeding"');
    expect(html).toContain('М &lt; 2');
    expect(html).not.toContain('codex-ability');
    expect(html).not.toContain('<blockquote>');
    expect(html).not.toContain('role="button"');
  });

  it('recognizes markerless fact tables and classifies the reported angulotl actions correctly', () => {
    const pack = read('src/generated/rules/articles/monsters.monster.angulotl.statblock.angulotl-slink.json');
    const tree = parser.parse(pack.entities[0].markdown);
    remarkDirectorAbilities()(tree);
    const cards: Record<string, unknown>[] = [];
    const groups: string[] = [];
    walk(tree, node => {
      const props = node.data?.hProperties;
      if (props?.['data-director-slot'] === 'card') cards.push(props);
      if (props?.['data-director-slot'] === 'ability-group') groups.push(String(props['data-action']));
    });
    expect(cards.find(card => card['data-name'] === 'Удар языком')?.['data-action']).toBe('main');
    expect(cards.find(card => card['data-name'] === 'Живо!')?.['data-action']).toBe('free-maneuver');
    expect(groups).toEqual(['main', 'free-maneuver', 'passive']);
    const html = render(pack.entities[0].markdown);
    expect(html.match(/class="sheet-ability-meta"/g)).toHaveLength(2);
    expect(html).not.toContain('<table');
    expect(html.match(/title="Ключевые слова"/g)).toHaveLength(1);
    expect(html).toContain('Стоимость: 2 Раздора');
    for (const text of ['Ближний бой 6', 'Одно существо или', 'На себя']) expect(visibleText(html)).toContain(text);
  });

  it('recognizes markerless villain parameters without assigning them a normal action or rendering empty facts', () => {
    const record = records.find((r: any) => r.id === 'monster.angulotl.statblock.angulotl-daybringer');
    const tree = parser.parse(record.markdown);
    remarkDirectorAbilities()(tree);
    const villains: Nodes[] = [];
    walk(tree, node => { if (node.data?.hProperties?.['data-kind'] === 'villain') villains.push(node); });
    expect(villains).toHaveLength(3);
    for (const villain of villains) {
      expect(villain.data?.hProperties?.['data-action']).toBe('none');
      let facts = 0;
      walk(villain, node => {
        expect(node.type).not.toBe('table');
        if (node.data?.hProperties?.['data-director-slot'] === 'facts') {
          facts++;
          expect('children' in node && node.children.some(child => child.data?.hProperties?.['data-director-slot'] === 'Действие')).toBe(false);
        }
      });
      expect(facts).toBe(1);
    }
  });

  it('handles table-free Malice, variable costs, villain actions and nested rules without inventing an action', () => {
    const html = render(`> ⭐️ **Туман (3–7+ [Раздора](#/codex/malice) за цель)**
>
> **Условие:** В начале раунда.
>
> - **≤11:** 5 урона ядом; [ослабление](#/codex/weakened).
> - **12–16:** М < 2 — ослабление.
> - **17+:** Без эффекта.
>
> **Потратить:** Ещё 2 Раздора.
>
> - Список
>   - Вложенное исключение
>
> | Добавка | Значение |
> | --- | --- |
> | Предел | 42 |

> ☠️ **Последний шанс ([Действие злодея](#/codex/villain) 3)**
>
> До конца следующего хода.
`);
    expect(html).toContain('Стоимость: 3–7+ Раздора за цель');
    expect(html).toContain('data-action="none"');
    expect(html).toContain('data-kind="villain"');
    expect(html).toContain('data-type="poison"');
    for (const text of ['Ещё 2 Раздора', 'Вложенное исключение', '42', 'До конца следующего хода', 'href="#/codex/villain"']) expect(html).toContain(text);
    expect(html).toContain('<table>');
    expect(html).not.toContain('Основное действие');
  });

  it('retains retainer level headings and encounter abilities, and distinguishes free triggers', () => {
    const feature = records.find((r: any) => r.id === 'monster.retainer.advancement-features.goblin-guide');
    const html = render(feature.markdown);
    expect(html.match(/class="sheet-ability-card is-full director-ability"/g)).toHaveLength(3);
    for (const level of [4, 7, 10]) expect(html).toContain(`${level}-го уровня`);
    expect(html).toContain('data-kind="encounter"');
    expect(html).toContain('наивысшая характеристика');
    const trigger = render(`> ❗️ **Ответ**
>
> | Псионика | Бесплатное триггерное действие |
> | --- | --- |
> | 📏 5 | 🎯 Одно существо |
>
> **Триггер:** Союзник получает урон.
>
> **Эффект:** Цель перемещается на 3 клетки.
`);
    expect(trigger).toContain('data-action="free-trigger"');
    expect(visibleText(trigger)).toContain('Союзник получает урон');
    expect(visibleText(trigger)).toContain('Цель перемещается на 3 клетки');
  });

  it('leaves ordinary lore callouts intact and separates consecutive abilities inside one quote', () => {
    const html = render(`> **Записка ведущему**
>
> Это обычная врезка, а не способность.

> ⭐️ **Первая черта**
>
> Начальный эффект.
>
> ❇️ **Вторая черта**
>
> Последний эффект.
`);
    expect(html.match(/class="sheet-ability-card is-full director-ability"/g)).toHaveLength(2);
    expect(html).toContain('<blockquote>');
    for (const text of ['Записка ведущему', 'Начальный эффект', 'Последний эффект']) expect(html).toContain(text);
  });

  it('groups actions in sheet order while retaining prose and retainer levels as separate contexts', () => {
    const ability = (name: string, action?: string) => `> ⭐️ **${name}**\n>\n${action ? `> | Магия | ${action} |\n> | --- | --- |\n> | 📏 5 | 🎯 Одно существо |\n>\n` : ''}> **Эффект:** Полный текст.\n\n`;
    const text = '## Уровень 4\n\n'
      + ability('Ответ', 'Триггерное действие') + ability('Первая атака', 'Основное действие')
      + ability('Свободный ответ', 'Свободный триггер') + ability('Вторая атака (2 Раздора)', 'Основное действие')
      + ability('Опасность (3 Раздора)') + ability('Начало (Действие злодея 1)')
      + ability('Финал (Действие злодея 2)') + ability('Невидимость')
      + 'Пояснение между разделами.\n\n## Уровень 7\n\n'
      + ability('Высшая атака', 'Основное действие');
    const tree = parser.parse(text);
    remarkDirectorAbilities()(tree);
    const sections = tree.children.filter(node => node.data?.hProperties?.['data-director-slot'] === 'ability-groups') as Blockquote[];
    expect(sections).toHaveLength(2);
    const groups = sections[0].children as Blockquote[];
    expect(groups.map(node => node.data?.hProperties?.['data-action'])).toEqual(['main', 'trigger', 'free-trigger', 'malice', 'villain', 'passive']);
    expect(groups[0].children.map(node => node.data?.hProperties?.['data-name'])).toEqual(['Первая атака', 'Вторая атака']);
    expect(groups[4].children.map(node => node.data?.hProperties?.['data-name'])).toEqual(['Начало', 'Финал']);
    expect(tree.children.map(node => node.type === 'heading' ? `heading:${node.depth}` : node.data?.hProperties?.['data-director-slot'] ?? node.type))
      .toEqual(['heading:2', 'ability-groups', 'paragraph', 'heading:2', 'ability-groups']);
    const html = render(text);
    expect(html.match(/class="sheet-ability-grid"/g)).toHaveLength(7);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(7);
    expect(html).toContain('class="sheet-ability-count mono">2</span>');
    for (const name of ['Раздор', 'Действия злодея', 'Пассивные черты', 'Пояснение между разделами']) expect(html).toContain(name);
  });

  it('uses an accessible group toggle and excludes collapsed cards from the rendered content', () => {
    const props = { action: 'main', label: 'Основное действие', count: 2, children: createElement('p', null, 'Текст карточек') };
    const expanded = renderToStaticMarkup(createElement(AbilityGroup, props));
    expect(expanded).toContain('aria-expanded="true"');
    expect(expanded).toContain('Текст карточек');
    const collapsed = renderToStaticMarkup(createElement(AbilityGroup, { ...props, collapsed: true, onToggle() {} }));
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).not.toContain('Текст карточек');
    const controlledId = collapsed.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controlledId).toBeTruthy();
    expect(collapsed).toContain(`id="${controlledId}" hidden=""`);
    expect(collapsed).toContain('type="button"');
  });
});
