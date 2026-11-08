import type { ItemEffect } from "../types";
import { Button } from "./ui";
import { ITEM_EFFECT_LABELS, normalizeItemEffects } from "../lib/item-effects";
import "./ItemEffectsEditor.css";

export function ItemEffectsSummary({ effects }: { effects: ItemEffect[] }) {
  const valid = normalizeItemEffects(effects);
  if (!valid.length) return null;
  return (
    <ul className="item-effects-summary">
      {valid.map((effect, index) => (
        <li key={index}>
          {ITEM_EFFECT_LABELS[effect.field]}: {effect.value > 0 ? "+" : ""}
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
  const valid = normalizeItemEffects(effects);
  return (
    <div className="item-effects-editor">
      {valid.map((effect, index) => (
        <div className="item-effects-row" key={index}>
          <select
            className="select"
            aria-label={`Показатель бонуса ${index + 1}`}
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
                {label}
              </option>
            ))}
          </select>
          <input
            className="input"
            aria-label={`Значение бонуса ${index + 1}`}
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
            aria-label={`Удалить бонус: ${ITEM_EFFECT_LABELS[effect.field]}`}
            disabled={disabled}
            onClick={() => onChange(valid.filter((_, i) => i !== index))}
          >
            Удалить
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
        Добавить бонус
      </Button>
    </div>
  );
}
