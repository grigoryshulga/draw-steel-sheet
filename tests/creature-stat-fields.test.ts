import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Nodes } from 'mdast';
import { remarkDirectorBlocks } from '../src/lib/remark-director-blocks';
import { DirectorStaminaContext } from '../src/components/rules/DirectorStatBlock';
import { RuleMarkdown } from '../src/components/rules/RuleMarkdown';

const pack = JSON.parse(readFileSync('src/generated/rules/articles/monsters.monster.goblin.statblock.goblin-warrior.json', 'utf8'));
const entity = pack.entities[0];
const parser = unified().use(remarkParse).use(remarkGfm);

function fieldIds(text: string) {
  const tree = parser.parse(text);
  remarkDirectorBlocks()(tree);
  const ids: string[] = [];
  const walk = (node: Nodes) => {
    if (node.data?.hProperties?.['data-director-slot'] === 'stat') ids.push(String(node.data.hProperties['data-director-field']));
    if ('children' in node) node.children.forEach(walk);
  };
  walk(tree);
  return ids;
}

describe('creature stat field identities', () => {
  it('assigns matching neutral identities to the Russian and English Goblin Warrior', () => {
    expect(fieldIds(entity.markdown)).toEqual(fieldIds(entity.originalDescription));
    expect(fieldIds(entity.markdown)).toEqual(['size', 'speed', 'stamina', 'stability', 'free-strike', 'immunity', 'movement', 'with-captain', 'weakness', 'might', 'agility', 'reason', 'intuition', 'presence']);
  });
  it.each(['ru', 'en'] as const)('keeps values and uses live stamina in %s', language => {
    const html = renderToStaticMarkup(createElement(DirectorStaminaContext.Provider, { value: { label: 'Live', value: 0 } },
      createElement(RuleMarkdown, { text: language === 'en' ? entity.originalDescription : entity.markdown, articleId: entity.source.articleId, sourceLocale: language })));
    expect(html).toContain('Live');
    expect(html).toContain('<dd class="numeric">0</dd>');
    expect(html).toContain('<strong>-2</strong>');
    expect(html).toContain('<strong>+2</strong>');
    expect(html.match(/director-mini-characteristic-label/g)).toHaveLength(5);
  });
  it('preserves rich unfamiliar fields and marks weakness semantically', () => {
    const text = `| Humanoid | - | Level 1 | Horde | EV 3 |
| --- | --- | --- | --- | --- |
| **1S**<br>Size | **5**<br>Speed | **10**<br>Stamina | **0**<br>Stability | **1**<br>Free Strike |
| [Fire](#/fire) 2<br>Weakness | **Special**<br>Unfamiliar | - | - | - |
| **-1**<br>Might | **0**<br>Agility | **0**<br>Reason | **2**<br>Intuition | **2**<br>Presence |`;
    const html = renderToStaticMarkup(createElement(RuleMarkdown, { text, articleId: 'monsters.test', sourceLocale: 'en' }));
    expect(html).toContain('data-weakness="true"');
    expect(html).toContain('href="#/fire"');
    expect(html).toContain('<strong>Special</strong>');
    expect(html).toContain('Unfamiliar');
  });
});
