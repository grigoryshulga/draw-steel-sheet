import type { Root, RootContent, PhrasingContent, Nodes, Paragraph, Blockquote } from 'mdast';

function slot(name: string, children: PhrasingContent[]): Paragraph {
  return { type: 'paragraph', children,
    data: { hName: 'span', hProperties: { 'data-director-slot': name } } };
}

/** Source stat tables become a compact sheet; no raw HTML is enabled. */
export function remarkDirectorBlocks() {
  return (tree: Root) => {
    const breaks = (node: Nodes) => {
      if (!('children' in node)) return;
      node.children.forEach((child, index) => {
        if (child.type === 'html' && /^<br\s*\/?\s*>$/i.test(child.value)) {
          node.children[index] = { type: 'break' } as never;
        } else breaks(child);
      });
    };
    breaks(tree);
    const text = (node: Nodes): string => 'value' in node ? node.value : 'children' in node ? node.children.map(text).join('') : '';
    const visit = (nodes: RootContent[]) => {
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (node.type === 'blockquote') { visit(node.children); continue; }
        if (node.type !== 'table' || node.children[0]?.children.length !== 5
          || !/(?:Уровень\s+\d|\d+-й\s+уровень)/i.test(text(node.children[0])) || !/Выносливость/i.test(text(node))
          || !node.children.some(row => row.children.some(cell => cell.children.some(child => child.type === 'break')))) continue;
        const header = node.children[0].children;
        const identity = [slot('keywords', header[0].children), slot('level', header[2].children),
          slot('organization', header[3].children), slot('ev', header[4].children)];
        const fields = node.children.slice(1).flatMap(row => row.children.flatMap<Paragraph | Blockquote>(cell => {
          const split = cell.children.findIndex(child => child.type === 'break');
          // Empty alignment cells carry no rule. Preserve any unfamiliar text.
          if (split < 0) return /^\s*[-—]?\s*$/.test(text(cell)) ? [] : [slot('extra', cell.children)];
          return [{ type: 'blockquote' as const,
            data: { hName: 'div', hProperties: { 'data-director-slot': 'stat' } },
            children: [slot('value', cell.children.slice(0, split)), slot('label', cell.children.slice(split + 1))],
          }];
        }));
        nodes[index] = {
          type: 'blockquote', data: { hName: 'div', hProperties: { 'data-director-stats': 'true' } },
          children: [...identity, ...fields],
        };
      }
    };
    visit(tree.children);
  };
}
