import { headingId } from './common.mjs';
import { decorateGlossary } from './originals.mjs';

const fullRules = new Set(['Malice', 'Villain Actions', 'Creature Free Strikes', 'Attached Squad Captain']);
export function directorGlossaryId(record) {
  if (record.director?.recordType !== 'rule' || fullRules.has(record.originalName)) return undefined;
  return decorateGlossary({ id: record.id, english: record.originalName }).id;
}

const leafAliases = {
  'characteristic': 'characteristics', recoveries: 'recovery', shifting: 'shift',
  'end-of-turn': 'eot', charge: 'charge main action', grab: 'grab maneuver',
  'escape-grab': 'escape grab maneuver', hide: 'hide maneuver', knockback: 'knockback maneuver',
  'search-for-hidden-creatures': 'search for hidden creatures maneuver', 'stand-up': 'stand up maneuver',
};

/** Resolve source links at build time. No source corpus or English prose in the navigation bundle. */
export function createDirectorLinkResolver(articles, entities) {
  const targets = new Map();
  const href = article => directorGlossaryId(article) ? `#/catalog/glossary#term-${directorGlossaryId(article)}` : article.director && ["statblock", "dynamic-terrain"].includes(article.director.recordType) ? `#/catalog/${article.director.section}/${article.id}` : `#/codex/${article.id}`;
  const byArticle = new Map(articles.map(article => [article.id, article]));
  for (const article of articles) if (article.originalId) targets.set(article.originalId, href(article));
  for (const entity of entities) if (entity.originalId) targets.set(entity.originalId, href(byArticle.get(entity.source.articleId)));
  const glossaryArticle = articles.find(article => article.id === '0102');
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const glossary = glossaryArticle?.blocks.map(block => block.type === 'markdown' ? block.text : entityById.get(block.ref)?.markdown ?? '').join('') ?? '';
  const terms = new Map();
  for (const match of glossary.matchAll(/^\*\*([^*\n]+)\s+\(([^)]+)\)\*\*:/gm)) {
    const { id } = decorateGlossary({ id: headingId(match[1]), english: match[2] });
    terms.set(match[2].toLowerCase(), `#/catalog/glossary#term-${encodeURIComponent(id)}`);
  }
  const special = {
    'mcdm.heroes.v1/rule.world/orden': '#/codex/2002',
    'mcdm.heroes.v1/rule.world/vasloria': '#/codex/2002',
    'mcdm.heroes.v1/skill.lore/psionics': '#/codex/1208',
  };
  return markdown => markdown.replace(/\[([^\]]+)\]\(scc\.v1:([^)]+)\)/g, (_all, label, scc) => {
    const leaf = scc.split('/').at(-1);
    const term = leafAliases[leaf] ?? leaf.replaceAll('-', ' ');
    const href = targets.get(scc) ?? special[scc] ?? (scc.startsWith('mcdm.heroes.v1/') ? terms.get(term) : undefined);
    if (!href) throw new Error(`Unresolved Monsters source link: ${scc}`);
    return `[${label}](${href})`;
  });
}

/** Include lower-echelon rules too: higher-echelon Malice explicitly refers to them. */
export function availableMaliceArticles(article, articles) {
  const d = article.director;
  if (d?.section !== 'monsters' || d.recordType !== 'statblock') return [];
  return articles.filter(candidate => {
    const other = candidate.director;
    if (other?.groupSlug !== d.groupSlug || other.recordType !== 'featureblock' || !candidate.id.includes('malice')) return false;
    if (d.groupSlug === 'dragon') return candidate.id === article.id.replace('.statblock.', '.') + '-malice';
    return other.level === undefined || (d.level !== undefined && other.level <= d.level);
  }).sort((a, b) => (a.director.level ?? 0) - (b.director.level ?? 0));
}

/** Delivery enrichments only: canonical translations and original fields remain untouched. */
export function prepareDirectorContent(articles, entities) {
  const resolveLinks = createDirectorLinkResolver(articles, entities);
  const byId = new Map(articles.map(article => [article.id, article]));
  const roleSlugs = { Засадник: 'ambusher', Артиллерист: 'artillery', Громила: 'brute', Контроллер: 'controller', Защитник: 'defender', Налётчик: 'harrier', Проклинатель: 'hexer', Скакун: 'mount', Поддержка: 'support' };
  for (const entity of entities) if (entity.director) entity.markdown = resolveLinks(entity.markdown);
  for (const article of articles) {
    if (!article.director) continue;
    article.blocks = article.blocks.map(block => block.type === 'markdown' ? { ...block, text: resolveLinks(block.text) } : block);
    const d = article.director;
    const related = new Set();
    const malice = availableMaliceArticles(article, articles);
    for (const rules of malice) {
      article.blocks.push(...rules.blocks.filter(block => block.type === 'entity'));
    }
    if (d.recordType === 'statblock' && d.section === 'retainers') {
      related.add(article.id.replace('.statblock.', '.advancement-features.'));
      const role = roleSlugs[d.role];
      if (role) related.add(`monsters.monster.retainer.role-advancement.${role}`);
      // A retainer's progression belongs beside its base block. The original
      // records remain independently addressable in the Codex.
      for (const id of related) {
        const progression = byId.get(id);
        if (progression) article.blocks.push(...progression.blocks.filter(block => block.type === 'entity'));
      }
      related.add('monsters.chapter.retainers');
      related.add('monsters.guide.retainer-advancement');
    } else if (d.section === 'terrain') related.add('monsters.chapter.dynamic-terrain');
    else if (d.groupSlug && d.groupSlug !== 'retainer') {
      for (const sibling of articles) {
        if (sibling.director?.groupSlug !== d.groupSlug) continue;
        if (d.recordType === 'statblock' && sibling.id.includes('malice') && !malice.includes(sibling)) continue;
        if (d.recordType === 'monster' || sibling.director.recordType !== 'statblock') related.add(sibling.id);
      }
      related.add('monsters.rule.monster.malice');
    }
    if (article.id === 'monsters.chapter.retainers') {
      related.add('monsters.guide.retainer-advancement');
      for (const sibling of articles) if (sibling.director?.sourcePath.startsWith('monster/retainer/role-advancement/')) related.add(sibling.id);
    }
    related.delete(article.id);
    article.related = [...related].flatMap(id => byId.has(id) ? [{ id, title: byId.get(id).title }] : []);
  }
}

/** Compact filter fields; source bookkeeping stays in the lazily loaded article. */
export function directorIndexMetadata(article) {
  const { sourcePath, sourceRevision, ...fields } = article.director;
  return { ...fields, ...(directorGlossaryId(article) ? { glossaryId: directorGlossaryId(article) } : {}), originalName: article.originalName ?? '' };
}
