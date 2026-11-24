import { useEffect, useId, useState, type ReactNode, type KeyboardEvent } from 'react';
import type { RuleArticle, RuleEntity } from '../../rules/schema';
import { headingId } from '../../lib/codex';
import { RuleEntityView, ruleEntityAnchor } from './RuleEntity';
import { RuleMarkdown } from './RuleMarkdown';
import './CreatureTabs.css';
import { useRuleLanguage } from '../../i18n/locale';

export function CreatureTabs({ article, entities, headingLevel, headingActions }: {
  article: RuleArticle; entities: Record<string, RuleEntity>; headingLevel: number; headingActions?: ReactNode;
}) {
  const id = useId();
  const [tab, setTab] = useState(0);
  const blocks = article.blocks.flatMap(block => block.type === 'entity' && entities[block.ref] ? [entities[block.ref]] : []);
  const creature = blocks[0];
  const { language } = useRuleLanguage(creature?.id ?? article.id, creature?.originalDescription);
  const malice = blocks.slice(1).filter(entity => entity.id.includes('malice'));
  const others = blocks.slice(1).filter(entity => !entity.id.includes('malice'));
  useEffect(() => {
    const revealLinkedTab = () => {
      const encoded = window.location.hash.split('/').at(-1) ?? '';
      let anchor = encoded;
      try { anchor = decodeURIComponent(encoded); } catch { return; }
      const match = malice.some(entity => ruleEntityAnchor(entity) === anchor ||
        [entity.markdown, entity.englishEdition?.text ?? entity.originalDescription ?? ''].some(text =>
          [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].some(item => headingId(item[1].replace(/[*_`]/g, '')) === anchor)));
      if (!match) return;
      setTab(1);
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
    };
    revealLinkedTab();
    window.addEventListener('hashchange', revealLinkedTab);
    return () => window.removeEventListener('hashchange', revealLinkedTab);
  }, [article.id, entities]);
  const switchKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - tab : undefined;
    if (next === undefined) return;
    event.preventDefault(); setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return <div className="creature-tabs">
    <RuleEntityView entity={creature} directorMode="stats" headingLevel={headingLevel} headingActions={headingActions} />
    <div role="tablist" aria-label={language === 'en' ? 'Creature abilities' : 'Способности существа'} className="creature-tab-list">
      {[language === 'en' ? 'Actions' : 'Действия', language === 'en' ? 'Malice' : 'Раздор'].map((label, index) => <button key={label} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-selected={tab === index} aria-controls={`${id}-panel-${index}`}
        tabIndex={tab === index ? 0 : -1} onKeyDown={switchKey} onClick={() => setTab(index)}>{label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={tab !== 0} tabIndex={0}>
      <RuleEntityView entity={creature} directorMode="actions" withAnchor={false} headingLevel={headingLevel} />
      {others.map(entity => <RuleEntityView key={entity.id} entity={entity} />)}
    </div>
    <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={tab !== 1} tabIndex={0}>
      <RuleEntityView entity={creature} directorMode="malice" withAnchor={false} headingLevel={headingLevel} />
      {malice.map(entity => {
        const original = entity.englishEdition?.text || entity.originalDescription;
        const english = language === 'en' && Boolean(original?.trim());
        const edition = english ? 'en' : 'ru';
        return <section key={entity.id} id={ruleEntityAnchor(entity)} aria-label={english ? entity.englishEdition?.name || entity.originalName || entity.name : entity.name}>
          {entity.director?.level !== undefined && <p className="muted">{english ? `Level ${entity.director.level}+` : `От ${entity.director.level}-го уровня`}</p>}
          <RuleMarkdown printedCreature={entity.printedCreature?.[edition]} text={english ? original! : entity.markdown}
            articleId={entity.source.articleId} directorMode="cards" sourceLocale={edition} />
        </section>;
      })}
      {!malice.length && !/(Раздор|Malice)/iu.test(language === "en" ? creature.originalDescription || creature.markdown : creature.markdown) && <p className="muted">{language === "en" ? "This creature has no Malice features." : "У существа нет особенностей Раздора."}</p>}
    </div>
  </div>;
}
