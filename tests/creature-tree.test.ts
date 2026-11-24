import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { compileCreatureTree } from '../scripts/content/lib/printed-creature.mjs';
import { expandCreatureTree } from '../src/rules/creature-tree';
import { remarkDirectorAbilities } from '../src/lib/remark-director-abilities';
import { remarkDirectorBlocks } from '../src/lib/remark-director-blocks';

const sample = `# Испытание *дракона*

| Зверь | — | Уровень 3 | Солдат | БЦ 4 |
| --- | --- | --- | --- | --- |
| 30<br>Выносливость | 5<br>Скорость | — | — | — |

> 🗡 **Удар (Раздор 3)**
>
> | Магия | Основное действие |
> | --- | --- |
> | 📏 Ближний бой 1 | 🎯 Одно существо |
>
> **Бросок силы:**
>
> - **≤11:** 4 урона; [цель](https://example.org) *падает*.
> - **12–16:** 7 урона
> - **17+:** 10 урона

Текст <script>bad</script> после.
`;

function expected(markdown: string, language: 'ru' | 'en') {
  const p = unified().use(remarkParse).use(remarkGfm).use(remarkDirectorBlocks)
    .use(remarkDirectorAbilities, { language });
  const root = p.runSync(p.parse(markdown));
  function clean(node: any) {
    delete node.position;
    if (node.children) {
      node.children = node.children.map((child: any) => child.type === 'html' ? { type: 'text', value: child.value } : child);
      node.children.forEach(clean);
    }
  }
  clean(root);
  return root;
}

describe('compiled creature Markdown', () => {
  it.each(['ru', 'en'] as const)('retains transformed rich content in %s and creates independent trees', language => {
    const markdown = language === 'ru' ? sample : sample.replace('Испытание', 'Trial').replace('Раздор 3', 'Malice 3').replace('Основное действие', 'Main action');
    const packed = compileCreatureTree(markdown, language);
    const first = expandCreatureTree(packed);
    expect(first).toEqual(expected(markdown, language));
    const encoded = JSON.stringify(first);
    expect(encoded).toContain('data-director-stats');
    expect(encoded).toContain('data-tier');
    expect(encoded).toContain('https://example.org');
    expect(encoded).toContain('<script>');
    first.children.length = 0;
    expect(expandCreatureTree(packed)).toEqual(expected(markdown, language));
    expect(JSON.stringify(packed).length).toBeLessThan(encoded.length);
  });
});
