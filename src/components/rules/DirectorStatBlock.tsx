import type { ReactNode } from 'react';
import { CharacteristicGlyph } from '../CharacteristicGlyph';
import { Icon } from '../Icons';
import type { CharacteristicKey } from '../../types';
import { markdownElements, markdownSlot, markdownText } from './markdown-slots';
import './DirectorStatBlock.css';

const characteristics: [string, CharacteristicKey][] = [
  ['Мощь', 'might'], ['Ловкость', 'agility'], ['Разум', 'reason'], ['Интуиция', 'intuition'], ['Присутствие', 'presence'],
];
const combat = ['Выносливость', 'Свободный удар', 'Скорость', 'Устойчивость', 'Размер'];
const primary = new Set([...combat, ...characteristics.map(([label]) => label)]);

/** A read-only miniature of the hero sheet: printed values, no hero calculations. */
export function DirectorStatBlock({ children, heading, headingActions }: { children: ReactNode; heading?: ReactNode; headingActions?: ReactNode }) {
  const fields = markdownElements(children).filter(child => child.props['data-director-slot'] === 'stat').map(child => ({
    name: markdownText(markdownSlot(child.props.children, 'label')).trim(),
    label: markdownSlot(child.props.children, 'label'), value: markdownSlot(child.props.children, 'value'),
  }));
  const byName = new Map(fields.map(field => [field.name, field]));
  const details = fields.filter(field => !primary.has(field.name) && !/^\s*[-—]?\s*$/.test(markdownText(field.value)));
  const organization = markdownSlot(children, 'organization');
  const unitType = !/^\s*[-—]?\s*$/.test(markdownText(organization))
    ? <span className="director-mini-type">{organization}</span> : null;
  const rank = <div className="director-mini-unit">
    <span className="director-mini-level">{markdownSlot(children, 'level')}</span>
    {unitType}
  </div>;
  const keywords = <div className="director-mini-keywords">{markdownSlot(children, 'keywords')}</div>;
  const ev = <span className="director-mini-ev">{markdownSlot(children, 'ev')}</span>;
  return <section className="director-mini-sheet" aria-label="Блок характеристик существа">
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
    <dl className="director-mini-combat" aria-label="Боевые показатели">
      {combat.map(name => {
        const field = byName.get(name);
        if (!field) return null;
        return <div key={name} className={`director-mini-stat${name === 'Выносливость' ? ' is-primary' : ''}`}>
          <dt>{name === 'Выносливость' && <Icon name="heart" size={14} />}{field.label}</dt>
          <dd className="numeric">{field.value}</dd>
        </div>;
      })}
    </dl>
    <dl className="director-mini-characteristics" aria-label="Характеристики">
      {characteristics.map(([name, key]) => {
        const field = byName.get(name);
        if (!field) return null;
        return <div key={key} title={name}>
          <dt><span aria-hidden="true"><CharacteristicGlyph characteristic={key} /></span><span className="director-mini-characteristic-label">{field.label}</span></dt>
          <dd className="numeric">{field.value}</dd>
        </div>;
      })}
    </dl>
    {details.length > 0 && <dl className="director-mini-details" aria-label="Особые параметры">
      {details.map(field => <div key={field.name} data-weakness={field.name.startsWith('Уязвимость') ? 'true' : undefined}>
        <dt>{field.label}</dt><dd>{field.value}</dd>
      </div>)}
    </dl>}
    {markdownElements(children).filter(child => child.props['data-director-slot'] === 'extra')}
  </section>;
}
