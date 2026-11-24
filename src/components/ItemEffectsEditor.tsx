import { useLocale } from "../i18n/locale";
import type { ItemEffect } from "../types";
import { Button } from "./ui";
import { ITEM_EFFECT_LABELS, normalizeItemEffects } from "../lib/item-effects";
import "./ItemEffectsEditor.css";

const ENGLISH_EFFECTS: Record<ItemEffect["field"], string> = { stamina: "Stamina", recoveries: "Recoveries", speed: "Speed", stability: "Stability", disengage: "Disengage", save: "Saving throw", rolledDamage: "Rolled damage", freeStrikeDamage: "Free strike damage" };

export function ItemEffectsSummary({ effects }: { effects: ItemEffect[] }) {
  const { locale } = useLocale();
  const valid = normalizeItemEffects(effects);
  if (!valid.length) return null;
  return (
    <ul className="item-effects-summary">
      {valid.map((effect, index) => (
        <li key={index}>
          {locale === "en" ? ENGLISH_EFFECTS[effect.field] : ITEM_EFFECT_LABELS[effect.field]}: {effect.value > 0 ? "+" : ""}
          {effect.value}
        </li>
      ))}
    </ul>
  );
}

export function ItemEffectsEditor({
  effects,
  onChange,
  disabled,
}: {
  effects: ItemEffect[];
  onChange: (effects: ItemEffect[]) => void;
  disabled?: boolean;
}) {
  const { locale, t } = useLocale();
  const valid = normalizeItemEffects(effects);
  return (
    <div className="item-effects-editor">
      {valid.map((effect, index) => (
        <div className="item-effects-row" key={index}>
          <select
            className="select"
            aria-label={t(`Показатель бонуса ${index + 1}`, `Bonus statistic ${index + 1}`)}
            disabled={disabled}
            value={effect.field}
            onChange={(event) =>
              onChange(
                valid.map((entry, i) =>
                  i === index
                    ? {
                        ...entry,
                        field: event.target.value as ItemEffect["field"],
                      }
                    : entry,
                ),
              )
            }
          >
            {Object.entries(ITEM_EFFECT_LABELS).map(([field, label]) => (
              <option key={field} value={field}>
                {locale === "en" ? ENGLISH_EFFECTS[field as ItemEffect["field"]] : label}
              </option>
            ))}
          </select>
          <input
            className="input"
            aria-label={t(`Значение бонуса ${index + 1}`, `Bonus value ${index + 1}`)}
            type="number"
            min={-100}
            max={100}
            step={1}
            disabled={disabled}
            value={effect.value}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= -100 && value <= 100)
                onChange(
                  valid.map((entry, i) =>
                    i === index ? { ...entry, value } : entry,
                  ),
                );
            }}
          />
          <Button
            icon="trash"
            iconOnly
            variant="ghost"
            aria-label={t(`Удалить бонус: ${ITEM_EFFECT_LABELS[effect.field]}`, `Remove bonus: ${ENGLISH_EFFECTS[effect.field]}`)}
            disabled={disabled}
            onClick={() => onChange(valid.filter((_, i) => i !== index))}
          >
            {t("Удалить", "Remove")}
          </Button>
        </div>
      ))}
      <Button
        icon="plus"
        iconOnly
        variant="soft"
        disabled={disabled || valid.length >= 16}
        onClick={() => onChange([...valid, { field: "stamina", value: 0 }])}
      >
        {t("Добавить бонус", "Add bonus")}
      </Button>
    </div>
  );
}
