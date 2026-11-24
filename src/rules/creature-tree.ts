import type { Root } from 'mdast';

// Numeric tags are stable in generated content; unknown node types keep their name.
const nodeTypes = [
  'root', 'text', 'paragraph', 'strong', 'emphasis', 'link', 'blockquote',
  'heading', 'list', 'listItem', 'table', 'tableRow', 'tableCell', 'break',
  'inlineCode', 'code', 'delete', 'thematicBreak', 'image', 'definition',
  'linkReference', 'imageReference', 'footnoteDefinition', 'footnoteReference',
] as const;

// Text leaves are strings. Other nodes carry only the children and properties
// they have, distinguished by their types; source positions are never stored.
type PackedNode = string | [number | string, ...(string | PackedNode[] | Record<string, unknown>)[]];
export type PrintedCreatureTree = PackedNode;
type PlainNode = { type: string; children?: PlainNode[]; value?: string; position?: unknown; [key: string]: unknown };

/** Encode transformed mdast, preserving arbitrary node and renderer metadata. */
export function compactCreatureTree(root: Root): PrintedCreatureTree {
  function pack(node: PlainNode): PackedNode {
    const { type, children, value, position: _position, ...properties } = node;
    if (type === 'text' && value !== undefined && !children && !Object.keys(properties).length) return value;
    const typeIndex = nodeTypes.indexOf(type as typeof nodeTypes[number]);
    const result: Exclude<PackedNode, string> = [typeIndex < 0 ? type : typeIndex];
    if (value !== undefined) result.push(value);
    if (children !== undefined) result.push(children.map(pack));
    const data = properties.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      // Escape the codec marker if it occurs in unrelated authored metadata.
      if (Object.keys(d).length === 1 && '$' in d) properties.data = { $: [d] };
      const hp = d.hProperties;
      if (Object.keys(d).every(key => key === 'hName' || key === 'hProperties') && hp && typeof hp === 'object' && !Array.isArray(hp)) {
        const { 'data-director-slot': slot, 'data-director-stats': stats, ...rest } = hp as Record<string, unknown>;
        if (typeof slot === 'string' || stats === 'true') {
          // A slot has span/paragraph, section/card, or div/container markup.
          const defaultName = slot === 'card' ? 'section' : type === 'paragraph' ? 'span' : 'div';
          const compact: Record<string, unknown> = {};
          if (slot !== undefined) compact.s = slot;
          if (stats !== undefined) compact.t = stats;
          if (d.hName !== defaultName) compact.n = d.hName ?? null;
          if (Object.keys(rest).length) compact.p = rest;
          properties.data = { $: compact };
        }
      }
    }
    if (Object.keys(properties).length) result.push(properties);
    return result;
  }
  return pack(root as unknown as PlainNode);
}

/** Expand a fresh tree for each render: downstream remark plugins may mutate it. */
export function expandCreatureTree(tree: PrintedCreatureTree): Root {
  function unpack(packed: PackedNode): PlainNode {
    if (typeof packed === 'string') return { type: 'text', value: packed };
    const [tag, ...parts] = packed;
    const type = typeof tag === 'number' ? nodeTypes[tag] : tag;
    if (!type) throw new Error(`Unknown creature tree node: ${tag}`);
    const node: PlainNode = { type };
    for (const part of parts) {
      if (typeof part === 'string') node.value = part;
      else if (Array.isArray(part)) node.children = part.map(unpack);
      else Object.assign(node, structuredClone(part));
    }
    const data = node.data as Record<string, unknown> | undefined;
    if (data && Object.keys(data).length === 1 && Array.isArray(data.$)) {
      node.data = data.$[0];
    } else if (data && Object.keys(data).length === 1 && data.$ && typeof data.$ === 'object') {
      const compact = data.$ as Record<string, unknown>;
      const slot = compact.s;
      const defaultName = slot === 'card' ? 'section' : type === 'paragraph' ? 'span' : 'div';
      const hName = 'n' in compact ? compact.n : defaultName;
      const hProperties: Record<string, unknown> = { ...(compact.p as Record<string, unknown> | undefined) };
      if (slot !== undefined) hProperties['data-director-slot'] = slot;
      if (compact.t !== undefined) hProperties['data-director-stats'] = compact.t;
      node.data = { ...(hName !== null && { hName }), hProperties };
    }
    return node;
  }
  return unpack(tree) as unknown as Root;
}
