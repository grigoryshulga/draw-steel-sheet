import type { Root, RootContent, Blockquote, Paragraph, PhrasingContent, Nodes, Table, List } from 'mdast';
import { ACTION_TYPES } from '../data/actions';

const ICON_TITLE = /^[\s🗡🏹⭐️❗️☠️🔳❇️👤🌀⚔️❕]+$/u;
const TIER_LABELS = [/^(?:≤\s*11|11 или меньше):/, /^12\s*[-–]\s*16:/, /^(?:17\+|17 и выше):/];

export function directorText(node: Nodes): string {
  return 'value' in node ? node.value : 'children' in node ? node.children.map(directorText).join('') : '';
}

/** Slice visible characters while retaining emphasis and authored link destinations. */
function sliceInline(nodes: PhrasingContent[], start: number, end = Infinity): PhrasingContent[] {
  let offset = 0;
  return nodes.flatMap(node => {
    const length = directorText(node).length;
    const from = Math.max(0, start - offset), to = Math.min(length, end - offset);
    offset += length;
    if (from >= to) return [];
    if ('children' in node) return [{ ...node, children: sliceInline(node.children, from, to) } as PhrasingContent];
    if ('value' in node) return [{ ...node, value: node.value.slice(from, to) } as PhrasingContent];
    return [node];
  });
}

function inlineSlot(slot: string, children: PhrasingContent[]): Paragraph {
  return { type: 'paragraph', children, data: { hName: 'span', hProperties: { 'data-director-slot': slot } } };
}

function container(slot: string, children: RootContent[], properties: Record<string, string> = {}): Blockquote {
  return { type: 'blockquote', children: children as Blockquote['children'],
    data: { hName: 'div', hProperties: { 'data-director-slot': slot, ...properties } } };
}

function titleParts(node: RootContent | undefined) {
  if (node?.type !== 'paragraph') return undefined;
  const strong = node.children.at(-1);
  if (strong?.type !== 'strong') return undefined;
  const prefix = node.children.slice(0, -1).map(directorText).join('');
  if (prefix && !ICON_TITLE.test(prefix)) return undefined;
  return { content: strong.children, icon: prefix.trim() };
}

function factTable(node: RootContent, followsTitle = false): node is Table {
  if (node.type !== 'table' || node.children.length !== 2
    || !node.children.every(row => row.children.length === 2)) return false;
  const [header, values] = node.children;
  const action = directorText(header.children[1]).trim();
  // Some translations omit the distance/target glyphs. Recognize the printed
  // action too; villain actions have a dash in the table directly below the title.
  return (directorText(values.children[0]).includes('📏') && directorText(values.children[1]).includes('🎯'))
    || actionType(action) !== 'none'
    || (followsTitle && /^(?:[-—]|Без действия)$/i.test(action));
}

function actionType(value: string): string {
  const text = value.toLowerCase().replaceAll('ё', 'е');
  if (/триггер|по условию|ответное действие/.test(text)) return /свобод|бесплат/.test(text) ? 'free-trigger' : 'trigger';
  if (/маневр/.test(text)) return /свобод|бесплат/.test(text) ? 'free-maneuver' : 'maneuver';
  if (/основное действие/.test(text)) return 'main';
  if (/движени/.test(text)) return 'move';
  return 'none';
}

function tierList(node: RootContent): node is List {
  return node.type === 'list' && node.children.length === 3
    && node.children.every((item, index) => TIER_LABELS[index].test(directorText(item)));
}

/** Only isolate unambiguous printed damage. Mixed/conditional damage stays full prose. */
const DAMAGE = /^(\d+(?:\s*\+\s*(?:\d+(?:d\d+)?|[МЛРИП]))?)\s+((?:урона(?:\s+(?:кислотой|холодом|порчей|огн[её]м|молнией|ядом|звуком))?|(?:психического|святого|огненного|кислотного|звукового)\s+урона))(?=\s*(?:;|$))/iu;

function renderTiers(list: List): Blockquote {
  return container('tiers', list.children.map((item, index) => {
    const first = item.children[0];
    if (first?.type !== 'paragraph') throw new Error('A power-roll tier must start with text');
    const plain = directorText(first);
    const label = plain.match(TIER_LABELS[index])![0];
    const start = label.length + (plain.slice(label.length).match(/^\s*/)?.[0].length ?? 0);
    const damage = plain.slice(start).match(DAMAGE);
    const body = sliceInline(first.children, start);
    const delimiter = damage ? plain.slice(start + damage[0].length).match(/^[;\s]+/)?.[0].length ?? 0 : 0;
    return container('tier', [
      inlineSlot('range', sliceInline(first.children, 0, label.length)),
      inlineSlot('damage-value', damage ? sliceInline(body, 0, damage[1].length) : []),
      inlineSlot('damage-label', damage ? sliceInline(body, damage[1].length + 1, damage[0].length) : []),
      inlineSlot('effect', damage ? sliceInline(body, damage[0].length + delimiter) : body),
      ...item.children.slice(1),
    ], { 'data-tier': String(index + 1), 'data-range': label.replace(/:$/, '') });
  }));
}

function facts(table: Table): Blockquote {
  const [header, values] = table.children;
  const fields = [
    ['Действие', header.children[1]], ['Дист.', values.children[0]],
    ['Цель', values.children[1]], ['Ключевые слова', header.children[0]],
  ] as const;
  return container('facts', fields.filter(([label, cell]) =>
    !(['Действие', 'Ключевые слова'].includes(label) && /^\s*[-—]\s*$/.test(directorText(cell))),
  ).map(([label, cell]) => {
    // The glyph is represented by the shared fact icon; links remain rich text.
    const leading = directorText(cell).match(/^[📏🎯\s]+/u)?.[0].length ?? 0;
    return inlineSlot(label, sliceInline(cell.children, leading));
  }));
}

function card(nodes: Blockquote['children']): Blockquote | undefined {
  const title = titleParts(nodes[0]);
  const table = nodes.find((node, index): node is Table => factTable(node, index === 1));
  if (!title || (!title.icon && !table)) return undefined;
  const plain = title.content.map(directorText).join('');
  const suffix = plain.match(/\s+\(([^()]*)\)$/);
  const hasMeta = suffix && /раздор|знаковая|ключевая способность|столкновение|действие злодея/i.test(suffix[1]);
  const meta = hasMeta ? suffix[1] : '';
  const nameEnd = hasMeta ? suffix.index! : plain.length;
  const kind = /действие злодея/i.test(meta) ? 'villain'
    : /раздор/i.test(meta) ? 'malice'
    : /знаковая|ключевая способность/i.test(meta) ? 'signature'
    : /столкновение/i.test(meta) ? 'encounter'
    : !table && title.icon.includes('⭐') ? 'trait' : 'other';
  const action = table ? actionType(directorText(table.children[0].children[1])) : kind === 'trait' ? 'passive' : 'none';
  const result = container('card', [
    inlineSlot('name', sliceInline(title.content, 0, nameEnd)),
    inlineSlot('badge', hasMeta ? sliceInline(title.content, plain.length - meta.length - 1, plain.length - 1) : []),
    ...nodes.slice(1).map(node => {
      if (node === table) return facts(table);
      if (tierList(node)) return renderTiers(node);
      if (node.type === 'paragraph') {
        const label = directorText(node.children[0]);
        return { ...node, data: { hProperties: { className: [
          /^(?:Триггер|Условие):/i.test(label) ? 'sheet-ability-trigger-text'
            : /^Бросок силы/i.test(label) ? 'director-ability-roll' : 'director-ability-prose',
        ] } } };
      }
      return node;
    }),
  ], { 'data-action': action, 'data-kind': kind, 'data-name': plain.slice(0, nameEnd), 'data-cost': kind === 'malice' ? meta : '' });
  result.data!.hName = 'section';
  return result;
}

const GROUPS = [
  ...ACTION_TYPES.filter(type => type.key !== 'none'),
  { key: 'malice', label: 'Раздор' },
  { key: 'villain', label: 'Действия злодея' },
  { key: 'passive', label: 'Пассивные черты' },
  { key: 'none', label: 'Другие способности' },
];

function groupKey(node: RootContent): string {
  const properties = node.data!.hProperties!;
  if (properties['data-kind'] === 'villain') return 'villain';
  if (properties['data-action'] !== 'none') return String(properties['data-action']);
  return properties['data-kind'] === 'malice' ? 'malice' : 'none';
}

/** Group adjacent cards only: level headings and explanatory prose are boundaries. */
function groupCards(nodes: RootContent[]): RootContent[] {
  const result: RootContent[] = [];
  let run: RootContent[] = [];
  const flush = () => {
    if (!run.length) return;
    const groups = GROUPS.flatMap(group => {
      const items = run.filter(node => groupKey(node) === group.key);
      return items.length ? [container('ability-group', items, { 'data-action': group.key, 'data-label': group.label })] : [];
    });
    result.push(container('ability-groups', groups));
    run = [];
  };
  for (const node of nodes) {
    if (node.data?.hProperties?.['data-director-slot'] === 'card') run.push(node);
    else { flush(); result.push(node); }
  }
  flush();
  return result;
}

/** Monsters uses icon-prefixed headings even for traits and table-free Malice.
 * Keep prose, ordering and all nested rules; never build a lossy hero Ability.
 */
export function remarkDirectorAbilities() {
  return (tree: Root) => {
    function visit(nodes: RootContent[]): RootContent[] {
      // A few exported abilities put the icon/title immediately before the
      // quoted body (for example Frozen Pond's Icy Water upgrade).
      const joined: RootContent[] = [];
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index], next = nodes[index + 1];
        if (titleParts(node)?.icon && node.type === 'paragraph') {
          if (next?.type === 'blockquote') {
            joined.push({ ...next, children: [node, ...next.children] });
            index++;
          } else {
            const body: RootContent[] = [node];
            while (nodes[index + 1] && !['blockquote', 'heading'].includes(nodes[index + 1].type)
              && !titleParts(nodes[index + 1])?.icon) body.push(nodes[++index]);
            joined.push({ type: 'blockquote', children: body as Blockquote['children'] });
          }
        } else joined.push(node);
      }
      const convertedNodes = joined.flatMap(node => {
        if (node.type !== 'blockquote') return [node];
        const starts = node.children.flatMap((child, index) => titleParts(child)?.icon ? [index] : []);
        // Some source exports put multiple named abilities into one quotation.
        if (starts.length > 1 || (starts[0] ?? 0) > 0) {
          const result: RootContent[] = [];
          if (starts[0] > 0) result.push({ ...node, children: node.children.slice(0, starts[0]) });
          starts.forEach((start, index) => {
            const children = node.children.slice(start, starts[index + 1]);
            result.push(card(children) ?? { ...node, children });
          });
          return result;
        }
        const converted = card(node.children);
        return [converted ?? { ...node, children: visit(node.children) as Blockquote['children'] }];
      });
      return groupCards(convertedNodes);
    }
    tree.children = visit(tree.children);
  };
}
