import { createContext, useContext, type ReactNode } from 'react';
import { CharacteristicGlyph } from '../CharacteristicGlyph';
import { Icon } from '../Icons';
import type { CharacteristicKey } from '../../types';
import { markdownElements, markdownSlot, markdownText } from './markdown-slots';
import './DirectorStatBlock.css';

const characteristics: CharacteristicKey[] = ['might', 'agility', 'reason', 'intuition', 'presence'];
const combat = ['stamina', 'free-strike', 'speed', 'stability', 'size'];
const primary = new Set([...combat, ...characteristics]);

export type DirectorStaminaOverride = { label?: string; squad?: boolean; value: ReactNode };
export const DirectorStaminaContext = createContext<DirectorStaminaOverride | undefined>(undefined);

/** Creature reference with an optional live stamina value supplied by the table. */
export function DirectorStatBlock({ children, heading, headingActions, language }: { children: ReactNode; heading?: ReactNode; headingActions?: ReactNode; language?: 'ru' | 'en' }) {
  const english = language === 'en';
  const t = (ru: string, en: string) => english ? en : ru;
  const liveStamina = useContext(DirectorStaminaContext);
  const fields = markdownElements(children).filter(child => child.props['data-director-slot'] === 'stat').map(child => ({
    id: child.props['data-director-field'] ?? 'other',
    label: markdownSlot(child.props.children, 'label'), value: markdownSlot(child.props.children, 'value'),
  }));
  const byId = new Map(fields.map(field => [field.id, field]));
  const details = fields.filter(field => !primary.has(field.id) && !/^\s*[-—]?\s*$/.test(markdownText(field.value)));
  const organization = markdownSlot(children, 'organization');
  const unitType = !/^\s*[-—]?\s*$/.test(markdownText(organization))
    ? <span className="director-mini-type">{organization}</span> : null;
  const rank = <div className="director-mini-unit">
    <span className="director-mini-level">{markdownSlot(children, 'level')}</span>
    {unitType}
  </div>;
  const keywords = <div className="director-mini-keywords">{markdownSlot(children, 'keywords')}</div>;
  const ev = <span className="director-mini-ev">{markdownSlot(children, 'ev')}</span>;
  return <section className="director-mini-sheet" aria-label={t("Блок характеристик существа", "Creature stat block")}>
    <header className="director-mini-identity">
      {heading ? <div className="director-mini-heading">
        <div className="director-mini-name-group">{heading}{keywords}</div>
        <div className="director-mini-rank-group">{rank}{ev}</div>
        {headingActions}
      </div> : <>
        <div className="director-mini-rank">{rank}{ev}</div>
        {keywords}
      </>}
    </header>
    <dl className="director-mini-combat" aria-label={t("Боевые показатели", "Combat statistics")}>
      {combat.map(id => {
        const field = byId.get(id);
        const stamina = id === 'stamina';
        const override = stamina ? liveStamina : undefined;
        if (!field && !override) return null;
        return <div key={id} className={`director-mini-stat${stamina ? ' is-primary' : ''}${override ? ' has-stamina-editor' : ''}`}>
          <dt>{stamina && <Icon name="heart" size={14} />}{override?.label ?? (override?.squad ? t('Выносливость отряда', 'Squad stamina') : field?.label ?? t('Выносливость', 'Stamina'))}</dt>
          <dd className="numeric">{override ? override.value : field?.value}</dd>
        </div>;
      })}
    </dl>
    <dl className="director-mini-characteristics" aria-label={t("Характеристики", "Characteristics")}>
      {characteristics.map(key => {
        const field = byId.get(key);
        if (!field) return null;
        return <div key={key} title={markdownText(field.label)}>
          <dt><span aria-hidden="true"><CharacteristicGlyph characteristic={key} language={language} /></span><span className="director-mini-characteristic-label">{field.label}</span></dt>
          <dd className="numeric">{field.value}</dd>
        </div>;
      })}
    </dl>
    {details.length > 0 && <dl className="director-mini-details" aria-label={t("Особые параметры", "Additional statistics")}>
      {details.map((field, index) => <div key={`${field.id}-${index}`} data-weakness={field.id === 'weakness' ? 'true' : undefined}>
        <dt>{field.label}</dt><dd>{field.value}</dd>
      </div>)}
    </dl>}
    {markdownElements(children).filter(child => child.props['data-director-slot'] === 'extra')}
  </section>;
}
