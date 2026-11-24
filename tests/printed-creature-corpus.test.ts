import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Nodes, Root } from 'mdast';
import { walkJson } from '../scripts/content/lib/common.mjs';
import { remarkDirectorBlocks } from '../src/lib/remark-director-blocks';
import { remarkDirectorAbilities } from '../src/lib/remark-director-abilities';
import { expandCreatureTree } from '../src/rules/creature-tree';
import { RuleArticleContent } from '../src/components/rules/RuleArticle';
import { DirectorStaminaContext } from '../src/components/rules/DirectorStatBlock';
import { ArticleLanguageScope } from '../src/i18n/locale';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const physical = ['monster', 'retainer'].flatMap(kind => walkJson(`content/rules/entities/${kind}`).map(read));
const parser = unified().use(remarkParse).use(remarkGfm);
const packFor = (id: string) => read(`src/generated/rules/articles/${id}.json`);

// ReactMarkdown escapes literal HTML. The director transform has already
// converted the supported line breaks into Markdown breaks.
function legacyTree(markdown: string, language: 'ru' | 'en'): Root {
  const tree = parser.parse(markdown);
  remarkDirectorBlocks()(tree);
  remarkDirectorAbilities({ language })(tree);
  const clean = (node: any) => {
    delete node.position;
    if (node.children) {
      node.children = node.children.map((child: Nodes) => child.type === 'html' ? { type: 'text', value: child.value } : child);
      node.children.forEach(clean);
    }
  };
  clean(tree);
  return tree;
}

function render(pack: any, language: 'ru' | 'en', live = false) {
  const entities = Object.fromEntries(pack.entities.map((entity: any) => [entity.id, entity]));
  const article = createElement(ArticleLanguageScope, { language }, createElement(RuleArticleContent, { article: pack.articles[0], entities }));
  return renderToStaticMarkup(live
    ? createElement(DirectorStaminaContext, { value: { label: 'LIVE STAMINA', value: '987654' } }, article)
    : article);
}

function withoutStamina(html: string) {
  return html.replace(/<div class="director-mini-stat is-primary(?: has-stamina-editor)?">[\s\S]*?<\/div>/, 'STAMINA');
}

describe('compiled creature delivery', () => {
  it('matches the independent director transforms for every physical creature in both editions', () => {
    expect(physical).toHaveLength(437);
    let editions = 0;
    for (const source of physical) {
      const pack = packFor(source.source.articleId);
      const entity = pack.entities.find((item: any) => item.id === source.id);
      expect(entity, source.id).toBeDefined();
      for (const language of ['ru', 'en'] as const) {
        expect(entity.printedCreature?.[language], `${source.id} ${language}`).toBeDefined();
        const markdown = language === 'ru' ? entity.markdown : (entity.englishEdition?.text || entity.originalDescription);
        expect(markdown?.trim(), `${source.id} ${language}`).toBeTruthy();
        // Exact trees assert all field slots, text and values, ordered cards and
        // tiers, links, and surrounding prose, not just counts of cards.
        expect(expandCreatureTree(entity.printedCreature[language]), `${source.id} ${language}`).toEqual(legacyTree(markdown, language));
        editions++;
      }
    }
    expect(editions).toBe(874);
  }, 30000);

  it.each(['ru', 'en'] as const)('renders Goblin Warrior from compiled content in %s and overrides only scene stamina', language => {
    const pack = packFor('monsters.monster.goblin.statblock.goblin-warrior');
    const reference = render(pack, language);
    const scene = render(pack, language, true);
    expect(reference).not.toContain('987654');
    expect(scene).toContain('987654');
    expect(withoutStamina(scene)).toBe(withoutStamina(reference));
    expect(reference.match(/role="tab"/g)).toHaveLength(2);
    expect(reference).toContain('sheet-ability-tiers');
    expect(reference).toContain(language === 'en' ? 'Spear Charge' : 'Атака копьём');
    expect(reference).toContain(language === 'en' ? 'Bury the Point' : 'Стоимость: 2 Раздора');

    // Mutating source text cannot affect the creature when the compiled tree is used.
    const changed = structuredClone(pack);
    const creature = changed.entities.find((entity: any) => entity.kind === 'monster');
    creature.markdown = 'RAW SOURCE SENTINEL';
    creature.originalDescription = 'RAW SOURCE SENTINEL';
    expect(render(changed, language)).toBe(reference);
  });

  it.each(['ru', 'en'] as const)('preserves actual villain actions and group Malice in %s', language => {
    const pack = packFor('monsters.monster.elf-wode.statblock.wode-elf-warleader');
    const compiled = render(pack, language);
    const legacy = structuredClone(pack);
    for (const entity of legacy.entities) delete entity.printedCreature;
    expect(compiled).toBe(render(legacy, language));
    expect(compiled.match(/role="tab"/g)).toHaveLength(2);
    expect(compiled).toMatch(language === 'en' ? /Villain Action/i : /действие злодея/i);
    expect(compiled).toMatch(language === 'en' ? /Malice/i : /Раздор/i);
    expect(compiled).toContain('sheet-ability-tiers');
  });
});
