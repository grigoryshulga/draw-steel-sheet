import { expect, it } from 'vitest';
import book from '../src/data/codex.generated.json';
import library from '../src/data/library-articles.generated.json';

it('ships exactly the catalog and glossary chapters with unchanged content', () => {
  expect(library).toEqual(book.filter(({ id, chapter }) =>
    id === '0102' || /^(16|18|19)\./.test(chapter)));
  expect(library.length).toBeLessThan(book.length / 2);
});
