import type { Root, RootContent, Blockquote } from 'mdast';
export type DirectorView = 'stats' | 'actions' | 'malice' | 'cards';
/** Partition the existing rich card tree; canonical Markdown stays complete. */
export function remarkDirectorView({ mode }: { mode?: DirectorView }) {
  return (tree: Root) => {
    if (!mode) return;
    const select = (node: RootContent): RootContent[] => {
      const props = node.data?.hProperties;
      if (props?.['data-director-stats']) return mode === 'stats' ? [node] : [];
      if (mode === 'stats') return [];
      const slot = props?.['data-director-slot'];
      if (slot === 'card') return mode === 'cards' ? [node] : (props?.['data-kind'] === 'malice') === (mode === 'malice') ? [node] : [];
      if (slot === 'ability-groups' || slot === 'ability-group') {
        const children = (node as Blockquote).children.flatMap(select);
        return children.length ? [{ ...node, children } as Blockquote] : [];
      }
      return mode === 'actions' ? [node] : [];
    };
    tree.children = tree.children.flatMap(select);
  };
}
