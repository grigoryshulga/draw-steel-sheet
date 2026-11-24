import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkEnglishEmbeddedAbilities } from '../src/lib/remark-ability-blocks';
import { remarkDirectorAbilities } from '../src/lib/remark-director-abilities';
import { RuleMarkdown } from '../src/components/rules/RuleMarkdown';
import { KitRuleBody } from '../src/components/rules/KitRuleBody';

function record(article: string, id: string) {
  return JSON.parse(readFileSync(`src/generated/rules/articles/${article}.json`, 'utf8')).entities.find((item: { id: string }) => item.id === id);
}

describe('English embedded abilities', () => {
  it('normalizes the source shape without swallowing ordinary sections or losing links', () => {
    const source = '## Roar\n\n*Loud.*\n\n| Magic | Maneuver |\n|---|---|\n| 📏 1 | 🎯 One enemy |\n\n**Effect:** [Push](#/codex/1307) 1.\n\n## Afterward\n\nOther rules.\n\n| Key | Value |\n|---|---|\n| A | B |';
    const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
    remarkEnglishEmbeddedAbilities()(tree);
    const serialized = JSON.stringify(tree);
    expect(serialized).toContain('rule-ability-anchor');
    expect(serialized).toContain('#/codex/1307');
    expect(tree.children.filter(node => node.type === 'blockquote')).toHaveLength(1);
    expect(tree.children.some(node => node.type === 'heading' && JSON.stringify(node).includes('Afterward'))).toBe(true);
    remarkDirectorAbilities({ language: 'en' })(tree);
    expect(JSON.stringify(tree)).toContain('"data-director-slot":"card"');
  });
  it('renders an embedded ancestry ability as a full shared card', () => {
    const feature = record('0403', 'feature.trait.dragon-knight.draconian-pride');
    const html = renderToStaticMarkup(createElement(RuleMarkdown, { text: feature.originalDescription, articleId: '0403', sourceLocale: 'en' }));
    expect(html).toContain('sheet-ability-card');
    expect(html).toContain('Draconian Pride');
    expect(html).toContain('Power Roll');
    expect(html).toContain('12-16');
    expect(html).toContain('id="draconian-pride"');
  });
  it('keeps every source heading anchor and ability in a multi-choice trait', () => {
    const feature = record('0413', 'feature.trait.time-raider.psionic-gift');
    const html = renderToStaticMarkup(createElement(RuleMarkdown, { text: feature.originalDescription, articleId: '0413', sourceLocale: 'en' }));
    for (const anchor of ['concussive-slam', 'psionic-bolt', 'minor-acceleration']) {
      expect(html).toContain(`id="${anchor}"`);
      expect(html.split(`id="${anchor}"`)).toHaveLength(2);
    }
    expect(html.match(/class="sheet-ability-card is-full director-ability"/g)).toHaveLength(3);
    expect(html).toContain('psychic');
    expect(html).toContain('start of your next');
  });
  it('uses compact English kit bonuses without losing ability text', () => {
    const kit = record('0903', 'kit.rapid-fire');
    const html = renderToStaticMarkup(createElement(KitRuleBody, { text: kit.originalDescription, articleId: '0903', headingOffset: 0, sourceLocale: 'en' }));
    expect(html).toContain('class="kit-rule-bonuses"');
    expect(html).toContain('Ranged Damage Bonus');
    expect(html).toContain('kit-rule-tiers');
    expect(html).toContain('Two Shot');
    expect(html).toContain('sheet-ability-card');
  });
});
