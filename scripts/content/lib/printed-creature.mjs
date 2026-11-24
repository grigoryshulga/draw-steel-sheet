import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkDirectorBlocks } from '../../../src/lib/remark-director-blocks.ts';
import { remarkDirectorAbilities } from '../../../src/lib/remark-director-abilities.ts';
import { compactCreatureTree } from '../../../src/rules/creature-tree.ts';

/** Compile the same safe Markdown transforms used by the director reader. */
export function compileCreatureTree(markdown, language) {
  const processor = unified().use(remarkParse).use(remarkGfm)
    .use(remarkDirectorBlocks).use(remarkDirectorAbilities, { language });
  const tree = processor.runSync(processor.parse(markdown));
  // React Markdown renders raw HTML as escaped text. The stat transform has
  // already converted supported <br> tags to mdast breaks.
  const stripHtml = node => {
    if (!node.children) return;
    node.children = node.children.map(child => child.type === 'html' ? { type: 'text', value: child.value } : child);
    node.children.forEach(stripHtml);
  };
  stripHtml(tree);
  return compactCreatureTree(tree);
}
