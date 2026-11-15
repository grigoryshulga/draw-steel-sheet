import { kitBonusLabel } from "../data/kits";
import {
  resolvedKitBonuses,
  selectKitBonus,
  type KitBonusPreferences,
  type KitLoadout,
} from "../lib/kit-bonuses";
import { echelon } from "../lib/progression";
import { Select } from "./ui";
import "./KitBonuses.css";

/** The builder, inventory and replacement preview share one resolved loadout. */
export function KitBonuses({
  loadout,
  level,
  title = "Бонусы двух комплектов",
  onChange,
}: {
  loadout: KitLoadout;
  level?: number;
  title?: string;
  onChange?: (preferences: KitBonusPreferences) => void;
}) {
  const bonuses = resolvedKitBonuses(loadout);
  const tier = level === undefined ? 1 : echelon(level);
  if (!bonuses.length) return null;
  return (
    <section className="kit-loadout" aria-label={title}>
      <h3>{title}</h3>
      <div className="kit-loadout-table">
      <div className="kit-loadout-head" aria-hidden="true">
        <span>Бонус</span><span>Значение</span><span>Источник</span>
      </div>
      <dl className="kit-loadout-bonuses">
        {bonuses.map((bonus) => {
          const profile = bonus.value.includes("/") ? bonus.value.split("/") : null;
          const different = new Set(bonus.options.map((option) => option.value)).size > 1;
          const stamina = bonus.label === "выносливости";
          const value = stamina ? `+${parseFloat(bonus.value) * tier}${tier === 1 ? "/эш." : ""}` : bonus.value;
          return (
            <div className="kit-loadout-row" key={bonus.label}>
              <dt>{kitBonusLabel(bonus.label)}</dt>
              <dd className="kit-loadout-value">
                {profile ? (
                  <span className="kit-loadout-profile" aria-label={`По тирам: ${profile.join(", ")}`} title="≤11 / 12–16 / 17+">
                    {profile.map((value, tier) => (
                      <span key={tier}>{tier > 0 && <span className="kit-loadout-separator" aria-hidden="true"> / </span>}<strong>{value}</strong></span>
                    ))}
                  </span>
                ) : (
                  <>
                    <strong title={stamina ? bonus.value : undefined}>{value}</strong>
                    {stamina && tier > 1 && (
                      <small>+{parseFloat(bonus.value)}/эш.</small>
                    )}
                  </>
                )}
              </dd>
              <dd className="kit-loadout-source">
                <span className="sr-only">Источник: </span>
                {different && onChange ? (
                  <Select
                    aria-label={`${kitBonusLabel(bonus.label)}: источник бонуса`}
                    value={bonus.kit.name}
                    onChange={(event) => onChange(selectKitBonus(loadout.automation, bonus.label, event.target.value))}
                  >
                    {bonus.options.map((option) => (
                      <option key={option.kit.id} value={option.kit.name}>
                        {option.kit.name} · {option.value}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span title={bonus.options.map((option) => option.kit.name).join(", ")}>
                    {!different && bonus.options.length > 1 ? "Оба комплекта" : bonus.kit.name}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      </div>
    </section>
  );
}
