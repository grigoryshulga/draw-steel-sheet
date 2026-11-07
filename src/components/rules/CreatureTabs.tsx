import { useId, useState, type ReactNode, type KeyboardEvent } from 'react';
import type { RuleArticle, RuleEntity } from '../../rules/schema';
import { RuleEntityView } from './RuleEntity';
import { RuleMarkdown } from './RuleMarkdown';
import './CreatureTabs.css';

export function CreatureTabs({ article, entities, headingLevel, headingActions }: {
  article: RuleArticle; entities: Record<string, RuleEntity>; headingLevel: number; headingActions?: ReactNode;
}) {
  const id = useId();
  const [tab, setTab] = useState(0);
  const blocks = article.blocks.flatMap(block => block.type === 'entity' && entities[block.ref] ? [entities[block.ref]] : []);
  const creature = blocks[0];
  const malice = blocks.slice(1).filter(entity => entity.id.includes('malice'));
  const others = blocks.slice(1).filter(entity => !entity.id.includes('malice'));
  const switchKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - tab : undefined;
    if (next === undefined) return;
    event.preventDefault(); setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return <div className="creature-tabs">
    <RuleEntityView entity={creature} directorMode="stats" headingLevel={headingLevel} headingActions={headingActions} />
    <div role="tablist" aria-label="Способности существа" className="creature-tab-list">
      {['Действия', 'Раздор'].map((label, index) => <button key={label} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-selected={tab === index} aria-controls={`${id}-panel-${index}`}
        tabIndex={tab === index ? 0 : -1} onKeyDown={switchKey} onClick={() => setTab(index)}>{label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={tab !== 0} tabIndex={0}>
      <RuleEntityView entity={creature} directorMode="actions" withAnchor={false} headingLevel={headingLevel} />
      {others.map(entity => <RuleEntityView key={entity.id} entity={entity} />)}
    </div>
    <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={tab !== 1} tabIndex={0}>
      <RuleEntityView entity={creature} directorMode="malice" withAnchor={false} headingLevel={headingLevel} />
      {malice.map(entity => <section key={entity.id} aria-label={entity.name}>
        {entity.director?.level !== undefined && <p className="muted">От {entity.director.level}-го уровня</p>}
        <RuleMarkdown text={entity.markdown} articleId={entity.source.articleId} directorMode="cards" />
      </section>)}
      {!malice.length && !/Раздор/iu.test(creature.markdown) && <p className="muted">У существа нет особенностей Раздора.</p>}
    </div>
  </div>;
}
