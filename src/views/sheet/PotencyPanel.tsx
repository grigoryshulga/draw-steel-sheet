import { Icon } from "../../components/Icons";
import { useApp } from "../../state/AppContext";
import { formatBonus } from "../../lib/utils";

/** Компактный потенциал способностей от высочайшей характеристики. */
export function PotencyPanel() {
  const { derived } = useApp();
  const potency = derived.potency;
  return (
    <section
      className="potency-strip"
      title="Потенциал считается от высочайшей характеристики героя"
    >
      <span className="potency-strip-title">
        <Icon name="spark" size={14} />
        <span className="eyebrow">Потенциал</span>
      </span>

      <div className="potency-strip-values">
        <span className="potency-strip-value">
          Слабый <strong className="mono">{formatBonus(potency.weak)}</strong>
        </span>
        <span className="potency-strip-value">
          Средний <strong className="mono">{formatBonus(potency.average)}</strong>
        </span>
        <span className="potency-strip-value is-strong">
          Сильный <strong className="mono">{formatBonus(potency.strong)}</strong>
        </span>
      </div>
    </section>
  );
}
