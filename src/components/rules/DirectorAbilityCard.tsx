import type { ReactNode } from 'react';
import type { Element } from 'hast';
import type { Tier } from '../../lib/rule-display';
import { inferDamageType } from '../../lib/damageType';
import { AbilityCardFrame } from './AbilityCardFrame';
import { AbilityGroup } from './AbilityGroup';
import { AbilityFacts, AbilityTiers, type AbilityTierView } from './AbilitySheet';
import { markdownElements as elements, markdownSlot as content, markdownText as plain } from './markdown-slots';
import './DirectorAbilityCard.css';

/** Adapt Markdown slots to the same frame, facts and tier rows as hero cards.
 * Source links and nested rules are React nodes, never flattened into strings.
 */
export function directorAbilityElement(node: Element | undefined, children: ReactNode): ReactNode | undefined {
  const slot = node?.properties['data-director-slot'];
  if (slot === 'ability-groups') return <div className="sheet-ability-sections director-ability-sections">{children}</div>;
  if (slot === 'ability-group') {
    const cards = elements(children);
    return <AbilityGroup action={String(node!.properties['data-action'])}
      label={String(node!.properties['data-label'])} count={cards.length}>{cards}</AbilityGroup>;
  }
  if (slot === 'card') {
    const badge = content(children, 'badge');
    const cost = String(node!.properties['data-cost'] || '');
    const kind = String(node!.properties['data-kind']);
    return <AbilityCardFrame title={content(children, 'name')} titleText={String(node!.properties['data-name'])}
      actionType={String(node!.properties['data-action'])} kind={kind} full className="director-ability"
      tags={(plain(badge) || kind === 'trait') && <span className="sheet-ability-card-tags">
        {cost ? <span className="sheet-ability-cost-stamp is-paid director-ability-cost" aria-label={`Стоимость: ${cost}`}>{badge}</span>
          : <span className="chip chip-static chip-default">{plain(badge) ? badge : 'Черта'}</span>}
      </span>}>
      {elements(children).filter(child => !['name', 'badge'].includes(child.props['data-director-slot'] ?? ''))}
    </AbilityCardFrame>;
  }
  if (slot === 'facts') {
    return <AbilityFacts view={{ keywords: [], facts: elements(children).map(child => ({
      label: child.props['data-director-slot']!, value: plain(child.props.children), content: child.props.children,
      title: child.props['data-director-slot'] === 'Дист.' ? 'Дистанция' : undefined,
    })) }} />;
  }
  if (slot === 'tiers') {
    const tiers: AbilityTierView[] = elements(children).map(child => {
      const value = plain(content(child.props.children, 'damage-value'));
      const label = content(child.props.children, 'damage-label');
      const rest = elements(child.props.children).filter(part => !part.props['data-director-slot']);
      const effect = content(child.props.children, 'effect');
      return {
        tier: Number(child.props['data-tier']) as Tier,
        range: child.props['data-range']!, rangeTitle: 'Диапазон суммы броска силы',
        damage: value ? { value, label, type: inferDamageType({ name: '', keywords: [], effect: plain(label) }) } : undefined,
        effectContent: plain(effect).trim() || rest.length ? <>{effect}{rest}</> : undefined,
      };
    });
    return <AbilityTiers tiers={tiers} />;
  }
  return undefined;
}
