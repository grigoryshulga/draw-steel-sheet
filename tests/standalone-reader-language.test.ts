import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ArticleLanguageScope } from '../src/i18n/locale';
import { ReaderContent } from '../src/components/rules/RuleArticleReader';
import type { LoadedRuleArticle } from '../src/rules/repository';

const data: LoadedRuleArticle = {
  article: { id: 'test', title: 'Правило', originalName: 'Rule', originalDescription: 'English text', chapter: '01', group: '', path: 'test', blocks: [{ type: 'markdown', text: 'Русский текст' }] },
  entities: {},
};
it('renders one language control for a standalone article and inherits a parent scope', () => {
  const plain = renderToStaticMarkup(createElement(ReaderContent, { data }));
  expect((plain.match(/class="article-language"/g) || [])).toHaveLength(1);
  expect(plain).toContain('Правило');
  const nested = renderToStaticMarkup(createElement(ArticleLanguageScope, { language: 'en' }, createElement(ReaderContent, { data })));
  expect(nested).not.toContain('class="article-language"');
  expect(nested).toContain('English text');
  expect(nested).toContain('Rule');
  expect(nested).not.toContain('Русский текст');
});

it('shows the glossary control only for the selected catalog entry with a definition', async () => {
  const { CatalogGlossaryEntry } = await import('../src/views/CatalogView');
  const { CANONICAL_GLOSSARY } = await import('../src/rules/consumer-library');
  const entry = CANONICAL_GLOSSARY.find((item) => item.hasEnglishDefinition)!;
  expect(entry).toBeDefined();
  const selected = renderToStaticMarkup(createElement(CatalogGlossaryEntry, { entry, selected: true }));
  const row = renderToStaticMarkup(createElement(CatalogGlossaryEntry, { entry, selected: false }));
  expect((selected.match(/class="article-language"/g) || [])).toHaveLength(1);
  expect(row).not.toContain('class="article-language"');
});
